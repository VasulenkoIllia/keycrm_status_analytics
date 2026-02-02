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

### Запуск
```bash
# 1) Переконайся, що зовнішня мережа Traefik існує
docker network create proxy  # якщо ще немає

# 2) Запуск зі збіркою
docker compose -f docker-compose.deploy.yml up -d --build

# 3) Прогнати міграції (обов'язково при першому розгортанні)
docker compose -f docker-compose.deploy.yml run --rm backend node scripts/run-migrations.js
```

### Змінні/порти
- БД: `PGUSER`, `PGPASSWORD`, `PGDATABASE` (за замовч. keycrm)
- Backend: PORT=4000 (експортується лише всередині traefik, зовнішній доступ через proxy)
- Frontend: служить на 80 всередині контейнера, Traefik термінує TLS
- VITE_API_BASE: прокидається під час білду фронту (див. docker-compose.deploy.yml)
- PUBLIC_BASE_URL (опц.): базовий публічний URL бекенду (https://orderstatus.workflo.space). Якщо `webhook_url` у БД порожній, бекенд згенерує `PUBLIC_BASE_URL/api/webhooks/keycrm?project={id}` автоматично при запиті `/api/settings/project`.

### Traefik
- Фронт: `https://orderstatus.workflo.space`
- API:   `https://orderstatus.workflo.space/api` (без stripPrefix)
- Сертифікати: resolver `cf`, entrypoint `websecure`

## Webhook URL-и
- Єдиний endpoint для вебхука KeyCRM (доступний без Bearer):  
  `https://orderstatus.workflo.space/api/webhooks/keycrm?project={PROJECT_ID}&token=<webhook_token>`
- Авторизація вебхука: token у query або заголовок `x-webhook-token`.
- Перевірка токена:
  1) якщо `WEBHOOK_TOKEN` env і збіг — прохід;
  2) інакше перевіряється `projects.webhook_token` для `project_id`; якщо поле пусте — прохід, якщо задане — має збігтися.
- `project` у query обов'язковий.

## Структура даних
- Усі налаштування та дані зберігаються в Postgres, Redis використовується лише як брокер подій (втрата ключів не критична — система самовідновиться, максимум потрібно рефрешнути UI).

## Типовий чекліст після деплою
1. `docker compose ... up -d --build`
2. `docker compose ... run --rm backend node scripts/run-migrations.js`
3. В UI → Налаштування → Проєкт: заповнити `base_url`, `api_token`, `webhook_url`, `webhook_token`.
4. Додати правила SLA/терміновості/робочі години під конкретний `project_id`.
5. Перевірити `/health` бекенду (200 OK).
6. Надіслати тестовий вебхук із KeyCRM на вказаний URL і переконатися, що замовлення з'явилось у списку.
