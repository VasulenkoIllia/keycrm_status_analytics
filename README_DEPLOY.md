# Деплой KeyCRM Status Analytics

## Склад
- **frontend**: Vite + React, видається через nginx
- **backend**: Node.js (Express), порт 4000
- **db**: PostgreSQL 16
- **redis**: Redis 7 (pub/sub для SSE)
- Traefik (зовнішній, мережа `proxy`) — для TLS і роутингу

## Docker / Compose
- Основний файл: `docker-compose.deploy.yml`
- Dockerfile-и: `Dockerfile.backend`, `Dockerfile.frontend`
- nginx конфіг фронту: `deploy/nginx.conf`
- Таймзона всіх контейнерів: `Europe/Kyiv`
- API відповіді віддаються з `Cache-Control: no-store` і без ETag, щоб фронт завжди бачив свіжі дані (більше трафіку, зате без 304/кешів).
- Якщо потрібен тимчасовий режим сумісності без токена вебхука: `ALLOW_EMPTY_WEBHOOK_TOKEN=true` (за замовчуванням вимкнено, без токена — 401).
- Авторизація в UI — cookie (JWT у `auth_token`, `SameSite=Lax`, `Secure` у prod).

### Приклади .env
- Dev: `.env.example.dev`
- Prod: `.env.example.prod`

Секрети не зберігаємо в репозиторії. Скопіюй потрібний файл у `.env` і заповни реальні значення.

### Запуск
```bash
# 1) Переконайся, що зовнішня мережа Traefik існує
docker network create proxy  # якщо ще немає

# 2) Запуск зі збіркою
docker compose -f docker-compose.deploy.yml up -d --build

# 3) Прогнати міграції (обов'язково при першому розгортанні та після оновлень)
docker compose -f docker-compose.deploy.yml run --rm backend node scripts/run-migrations.js

# 4) Залогінитись супер-адміном (seed із .env: SEED_SUPERADMIN_LOGIN/PASS, дефолт admin/admin),
#    створити користувачів і видати доступи до проєктів у UI (кнопка "Користувачі" на екрані вибору проєкту).
```

### Змінні/порти
- БД: `PGUSER`, `PGPASSWORD`, `PGDATABASE` (за замовч. keycrm)
- Backend: PORT=4000 (експортується лише всередині traefik, зовнішній доступ через proxy)
- Frontend: служить на 80 всередині контейнера, Traefik термінує TLS
- VITE_API_BASE: прокидається під час білду фронту (див. docker-compose.deploy.yml)
- PUBLIC_BASE_URL (опц.): базовий публічний URL бекенду (https://orderstatus.workflo.space). Якщо `webhook_url` у БД порожній, бекенд згенерує `PUBLIC_BASE_URL/api/webhooks/keycrm?project={id}` автоматично при запиті `/api/settings/project`.
- SEED_SUPERADMIN_LOGIN / SEED_SUPERADMIN_PASS — початковий супер-адмін (JWT логін), створюється при старті. Паролі мінімум 6 символів.
- JWT_SECRET — секрет підпису токенів (8 год).
- CORS_ORIGINS — allowlist доменів для cookie-auth (наприклад, `https://orderstatus.workflo.space`). Якщо фронт на іншому домені — додай його.
- WEBHOOK_TOKEN / ALLOW_EMPTY_WEBHOOK_TOKEN — для прийому вебхуків (див. нижче).
 - NODE_ENV=production — потрібен для `Secure` cookie у продакшні.

### Traefik
- Фронт: `https://orderstatus.workflo.space`
- API:   `https://orderstatus.workflo.space/api` (без stripPrefix)
- Сертифікати: resolver `cf`, entrypoint `websecure`

## Webhook URL-и
- Єдиний endpoint для вебхука KeyCRM:  
  `https://orderstatus.workflo.space/api/webhooks/keycrm?project={PROJECT_ID}&token=<webhook_token>`
- Авторизація вебхука: token у query або заголовок `x-webhook-token`.
- Перевірка токена:
  1) якщо `WEBHOOK_TOKEN` env і збіг — прохід;
  2) інакше перевіряється `projects.webhook_token` для `project_id`; **якщо токен проєкту відсутній або не переданий — 401**.
- `project` у query обов'язковий.
- Вебхук не потребує JWT, ACL для користувачів його не торкається.

## Доступ до БД з локального ПК (безпечний)
Рекомендовано відкривати БД **лише на localhost сервера** і підключатися через SSH-тунель.

У `docker-compose.deploy.yml` вже є маппінг:
```
127.0.0.1:15432:5432
```

Тунель:
```bash
ssh -L 15432:127.0.0.1:15432 user@your-server
```

Підключення локально:
- host: `127.0.0.1`
- port: `15432`
- user: `PGUSER`
- password: `PGPASSWORD`
- db: `PGDATABASE`

## Структура даних
- Усі налаштування та дані зберігаються в Postgres, Redis використовується лише як брокер подій (втрата ключів не критична — система самовідновиться, максимум потрібно рефрешнути UI).

## Типовий чекліст після деплою
1. `docker compose ... up -d --build`
2. `docker compose ... run --rm backend node scripts/run-migrations.js`
3. В UI → Налаштування → Проєкт: заповнити `base_url`, `api_token`, `webhook_url`, `webhook_token`.
4. Додати правила SLA/терміновості/робочі години під конкретний `project_id`.
5. Перевірити `/health` бекенду (200 OK).
6. Надіслати тестовий вебхук із KeyCRM на вказаний URL і переконатися, що замовлення з'явилось у списку.

## Додавання нового проєкту (KeyCRM)
1. Отримай статуси KeyCRM у JSON (активні):
```bash
KEYCRM_API_TOKEN=... node scripts/export-active-statuses.js > /tmp/statuses.json
```
2. Сід нового проєкту:
```bash
node scripts/seed-project.js --name "project-name" --status-file /tmp/statuses.json --token ... --base-url https://openapi.keycrm.app/v1
```
У проді можна виконати в контейнері:
```bash
docker compose -f docker-compose.deploy.yml run --rm backend \
  node scripts/seed-project.js --name "project-name" --status-file /tmp/statuses.json --token ... --base-url https://openapi.keycrm.app/v1
```
3. У UI перевір `webhook_token` і налаштуй вебхук:
```
/api/webhooks/keycrm?project=ID&token=WEBHOOK_TOKEN
```
