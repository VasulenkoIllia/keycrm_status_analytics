# План реалізації KeyCRM Status Analytics (multi-CRM)

Ціль: одна інфраструктура, що приймає вебхуки від 2+ CRM‑проєктів, обробляє події статусів, рахує інтервали/SLA та віддає агреговані дані фронтенду в реальному часі.

## 1. Архітектурні принципи
- **Event-log** як єдине джерело істини: ніколи не переписуємо інтервали, лише додаємо події.
- **Multi-project (multi-CRM)**: усі таблиці мають `project_id`/`source_id`; словники статусів та SLA зберігаються з прив’язкою до проєкту.
- **Idempotency**: кожен webhook має `dedup_key` (`order_id + status_changed_at`) з UNIQUE.
- **Агрегація на SQL**: інтервали через `LEAD()`; SLA забарвлення на бекенді.

## 2. Схема БД (PostgreSQL)
1) `projects` — довідник CRM: id, name, base_url, api_token, is_active.
2) `project_settings` — project_id, default_sla_profile, timezone (UTC by default), default_cycle_id (ref на cycle_rules), misc flags.
3) `status_group_dict` — project_id, group_id, group_name.
4) `status_dict` — project_id, status_id, name, alias, group_id, is_active, is_closing_order, expiration_period.
5) `sla_stage_rules` — project_id, group_id (або stage_key), limit_hours, is_urgent (bool) для жорсткіших SLA (дві сітки: звичайна/термінова).
6) `cycle_rules` — project_id, id, start_group_id (або start_status_id), end_group_id (або end_status_id), title (напр. “до доставки”, “повний цикл”).
7) `urgent_rules` — project_id, rule_name, match_type (sku|offer_id|product_id), match_value, is_active.
8) `order_overrides` — project_id, order_id, is_urgent_override (nullable), sla_profile_override (nullable), cycle_start_override, cycle_end_override.
9) `order_status_events` — project_id, order_id, status_id, status_group_id, status_changed_at, order_created_at, payload JSONB, dedup_key UNIQUE.
10) `orders_current` (materialized view/таблиця) — project_id, order_id, started_at, last_status_id, last_status_group_id, last_changed_at, is_urgent, delivery_entered_at, cycle_duration_to_delivery, closed_at, cycle_rule_id_applied.
11) `order_cycle_metrics` (view/materialized) — project_id, order_id, cycle_rule_id, duration_seconds (start→end по правилу), updated_at.
12) `order_items` — project_id, order_id, offer_id/sku/product_id, name, qty, price_sold, purchased_price, created_at.
13) `order_marketing` — project_id, order_id, utm_*, fbclid, _fbc, _fbp, raw_comment.
14) Індекси: `order_status_events(order_id, status_changed_at)`, `orders_current(project_id, last_status_group_id)`, `order_items(order_id)`, унікальний dedup.

## 3. Інгест словників
- Скрипти `fetch:statuses` / `export:statuses` запускаються окремо для кожного `project_id` (через env або аргумент).
- Завантажити `status_dict` і `status_group_dict` перед стартом вебхуків; мапа stage→group_id конфігурується в `sla_stage_rules`.

## 4. Webhook прийом
- Один endpoint `/webhooks/keycrm` із параметром `project` (query/path) або окремі URL на кожен проект; у таблицях завжди пишемо `project_id`.
- Кроки: валідація, dedup, INSERT в `order_status_events`, оновити `orders_current`.
- Асинхронно: якщо немає items для `order_id` — виклик `GET /order/{id}?include=products.offer` з токеном відповідного `project_id`.
- Логувати помилки, алерти на 5xx/429.
- **Dedup без втрати повторних статусів**: ключ `project_id + order_id + status_changed_at + status_id` (опційно `status_group_id`/hash payload). Це блокує лише ідентичні дублікати події; повторний вхід у той самий статус у інший момент часу збережеться як новий інтервал.
- **Запізнілі події**: після вставки будуємо інтервали за `ORDER BY status_changed_at`; розрахунок інтервалів слід виконувати у view/CTE, щоб коректно враховувати ретро-події.

## 5. Обчислення інтервалів і SLA
- View `order_status_intervals` з `LEAD(status_changed_at)` для кожного order_id.
- Агрегати по статусах і групах для періодів (day/week/month).
- Функція `sla_state(seconds, limit_hours, is_urgent)` повертає ok/near/over (для термінових — інший ліміт).
- Оновлення `is_urgent`: після фетчу `order_items` прапор пишеться в `orders_current`; якщо приходить нова подія і items відсутні, прапор розраховується після підвантаження.
- Повний цикл: визначаємо за `cycle_rules` (start_group/status → end_group/status); у `orders_current` зберігаємо `started_at`, `delivery_entered_at`, `cycle_duration_to_delivery`.
- Overrides: якщо є запис в `order_overrides`, беремо з нього `is_urgent`/SLA профіль/цикл замість rule-based.

## 5.1 Робочі дні та години (per stage, per project)
- Для кожного проекту зберігаємо набір робочих днів тижня та годинних вікон **окремо для кожної статус-групи** (наприклад, виробництво може працювати інакше, ніж погодження).
- При розрахунку інтервалів і SLA час поза робочими вікнами віднімаємо: тривалість статусу = сума перетинів з робочим календарем відповідної групи.
- Потрібно підтримати кілька вікон на день (наприклад, 09:00–13:00 і 14:00–18:00) та виняток вихідних (off).
- Зберігання: нова таблиця/налаштування `working_hours` (project_id, group_id, weekday, ranges JSON). Значення за замовчуванням — 24/7, щоб не зламати існуючу логику.
- API: `GET/PUT /api/settings/working-hours` з токеном; повертаємо/приймаємо структуру по групах і днях.
- UI: у Settings додати секцію редактора робочих днів/годин з пресетами “24/7”, “Пн–Пт 9–18”, ручне редагування слотів; зберігаємо на проект.
- Аналітика й картки замовлень повинні відображати SLA-стан із урахуванням робочого календаря; таймлайн може показувати “робочі” та “неробочі” відрізки (опційно для v2).

## 6. API та стрім для фронтенду
- `/api/orders` — список з KPI: тривалості по групах, поточний статус, кольори SLA.
- `/api/orders/{id}/timeline` — таймлайн подій.
- `/api/dicts/statuses` — словники для поточного проекту.
- `/api/settings/cycle` — повертає/приймає налаштування старт/фініш груп/статусів для циклу.
- `/api/stream/orders` — SSE-стрім оновлень (order_updated/invalidate) фільтрований за `project_id`.
- Відповіді включають `project_id`; фронт фільтрує по вибраному проекту.

## 6.1 Фронтенд UX (мінімум)
- **Login** (basic/password) — захищає додаток.
- **Головна (Home)**: вибір компанії/CRM (2+), блок налаштувань проекту: SLA правила, базовий URL, API ключ (тільки для admin view), можливі майбутні опції.
- **Сторінка CRM/Дашборд**:
  - Фільтри: дата-діапазон, номер замовлення, статус/група, проект (якщо перемикаємося без виходу).
  - KPI: кількість замовлень, середній час у групах, % SLA ok/near/over.
  - Список/картки замовлень з поточним статусом і SLA-баром.
  - Таймлайн замовлення (модалка/друга панель).
- Стиль: мінімалістичний, темна тема вже є; зберігаємо, додаємо акуратний layout для вибору CRM і налаштувань.
- **Вкладка Аналітика**: сумарний час по етапах, повний цикл, середні/медіани, “загальний час за всі замовлення за період”, розбиття звичайні vs термінові.
- **Налаштування циклу**: UI (модалка) для вибору старт/фініш груп/статусів (cycle rules) на проект, збереження через PUT.
- **Налаштування SLA**: форма для двох сіток (звичайна/термінова) по групах, вводимо в форматі `год:хв`, збереження через PUT `/api/settings/sla`.
- **Налаштування терміновості**: (TODO) редактор `urgent_rules` (за sku/offer_id/product_id) і ручний override на картці замовлення (пише в `order_overrides`).

## 7. Background jobs
- Періодичне оновлення статусів (`status_dict`) на випадок нових статусів у CRM.
- Ретраї фетчу товарів після вебхука.
- Архівація старих подій (опційно) у cold storage.

## 8. Безпека й ліміти
- Bearer токени зберігаються в `projects` (env/secret manager).
- Throttling 1 req/сек на проект до KeyCRM (ліміт 60 rpm).
- IP allowlist / підпис вебхуків (мінімум перевірка User-Agent + джерельного IP).

## 9. Деплой та дев
- Docker Compose: Postgres + бекенд.
- `.env`: DB, `KEYCRM_BASE_URL`, токени проектів.
- CI: lint/test, прогін міграцій.
- Локально: `docker compose up -d db` (Postgres), застосувати `db/0001_init.sql` через `psql -f db/0001_init.sql`.

## 10. Мінімальний план спринту (факт)
День 1: міграції БД (projects, статуси, urgent_rules, orders), моделі, завантаження словників двох проектів. ✅  
День 2: вебхук-хендлер + dedup + orders_current + флаг is_urgent (після items). ✅  
День 3: інтервали/SLA view (враховує urgent), API `/api/orders`, `/api/orders/{id}/timeline`. ✅  
День 4: фоновий фетч товарів + визначення `is_urgent`, ретраї, оновлення статусів. ✅  
День 5: харднінг, логування/моніторинг, фронт (Home вибір CRM + login + дашборд). ✅  
День 6: UI налаштувань SLA/циклів, аналітика, робочі години per stage, ліміт замовлень на дашборді, вебхук-статистика. ✅  
День 7: Ролі й доступи (users/user_projects, JWT), UI керування користувачами, показ поточного логіна/ролі. ✅  
Pending: повний UI редагування urgent_rules в налаштуваннях (частково), overrides на фронті (частково).

## 11. Вихідні дані, що вже є
- Вебхук приклад `order.change_order_status`.
- Повний список статусів із `group_id` та `group_name` у `statuses.json`.
- Скрипти для фетчу статусів (`fetch:statuses`, `export:statuses`).

## 12. Потенційно додатково
- **Авторизація/ролі**: роль admin для редагування токенів/SLA, роль viewer для перегляду дашборду.
- **Audit log**: хто міняв налаштування проекту, SLA, токени.
- **Моніторинг/алерти**: помилки вебхука, 429/5xx до KeyCRM, SLA breach > X%, затримка подій.
- **Realtime**: WebSocket/SSE для фронту (оновлення карток без перезавантаження).
- **Кеш/перф**: кеш словників у Redis/in-memory; пагінація й сортування на бекенді.
- **Бекфіл**: завантаження історичних подій/замовлень для нового проекту (одноразовий імпорт).
- **PII/безпека**: шифрування токенів у БД, маскування телефонів/e-mail у логах.
- **Data retention**: політика зберігання сирих подій vs агрегатів, архівація в S3/cold storage.
- **Таймзона**: усі розрахунки в UTC; конвертація у фронті під локаль користувача.
- **Urgent замовлення**: визначати терміновість за наявністю певного товару в `order_items` (rule-based список sku/offer_id). Зберігати ознаку `is_urgent` в `orders_current` і показувати окремо в KPI/фільтрах; SLA може бути жорсткішим для `is_urgent = true`.
- **Правило терміновості (поточний кейс)**: якщо в замовленні є товар зі `sku = "Термінове виготовлення"` або `offer_id = 16` (product_id 2) — вважаємо замовлення терміновим (`is_urgent = true`). Список правил має бути конфігурованим на проект.
- **Шина подій**: Redis Pub/Sub (або Postgres NOTIFY) як внутрішній брокер; транслей в браузер через SSE (`/api/stream/orders`). За потреби можна замінити на WebSocket, але стартуємо з SSE.
