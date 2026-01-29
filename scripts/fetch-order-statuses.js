// Простий скрипт для отримання списку статусів замовлень із keyCRM OpenAPI.
// Використовує токен з .env (KEYCRM_API_TOKEN) або з поточних змінних середовища.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

// Невеликий локальний loader .env без залежностей.
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

const TOKEN = process.env.KEYCRM_API_TOKEN;
const RAW_BASE = process.env.KEYCRM_BASE_URL || 'https://openapi.keycrm.app/v1';

function normalizeBase(urlStr) {
  const u = new URL(urlStr);
  // якщо шлях порожній або '/', додаємо /v1/
  if (!u.pathname || u.pathname === '/') {
    u.pathname = '/v1/';
  }
  // гарантуємо, що закінчується на '/'
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  return u.toString();
}

const BASE_URL = normalizeBase(RAW_BASE);

if (!TOKEN) {
  console.error('Помилка: відсутній KEYCRM_API_TOKEN. Додайте його у .env або змінні середовища.');
  process.exit(1);
}

const url = new URL('order/status', BASE_URL);

async function main() {
  const all = [];
  let pageUrl = url.toString();
  while (pageUrl) {
    console.log(`GET ${pageUrl}`);
    const res = await fetch(pageUrl, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Запит неуспішний: ${res.status} ${res.statusText}\n${text}`);
    }

    const data = await res.json();
    if (Array.isArray(data?.data)) {
      all.push(...data.data);
    }
    pageUrl = data?.next_page_url || null;
  }

  console.log(`Всього статусів: ${all.length}`);
  console.log(JSON.stringify(all, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
