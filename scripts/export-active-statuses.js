// Експорт усіх активних статусів замовлень, відсортованих за group_id та id.
// Виводить JSON-масив із полями: id, name, alias, is_active, group_id.
// Токен береться з .env (KEYCRM_API_TOKEN) або середовища.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

// Локальний loader .env
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
  if (!u.pathname || u.pathname === '/') u.pathname = '/v1/';
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  return u.toString();
}

const BASE_URL = normalizeBase(RAW_BASE);
const url = new URL('order/status', BASE_URL);

if (!TOKEN) {
  console.error('Помилка: відсутній KEYCRM_API_TOKEN. Додайте його у .env або змінні середовища.');
  process.exit(1);
}

async function fetchAllStatuses() {
  const all = [];
  let pageUrl = url.toString();
  while (pageUrl) {
    console.error(`GET ${pageUrl}`);
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
    if (Array.isArray(data?.data)) all.push(...data.data);
    pageUrl = data?.next_page_url || null;
  }
  return all;
}

async function main() {
  const all = await fetchAllStatuses();
  const active = all.filter((s) => s.is_active);
  active.sort((a, b) => (a.group_id - b.group_id) || (a.id - b.id));
  const minimal = active.map(({ id, name, alias, is_active, group_id }) => ({
    id,
    name,
    alias,
    is_active,
    group_id
  }));
  console.log(JSON.stringify(minimal, null, 2));
  console.error(`Всього активних статусів: ${minimal.length}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
