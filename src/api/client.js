let API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
let API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

export const setApiToken = (token) => {
  API_TOKEN = token || '';
};

export const setApiBase = (base) => {
  if (base) API_BASE = base.replace(/\/$/, '');
};

const authHeaders = () => (API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {});

export async function login(username, password) {
  const url = new URL('/api/login', API_BASE);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error('Невірний логін або пароль');
  const data = await res.json();
  if (data.token) {
    setApiToken(data.token);
  }
  return data;
}

export async function fetchOrders(projectId, params = {}) {
  const url = new URL('/api/orders', API_BASE);
  url.searchParams.set('project_id', projectId);
  if (params.from) url.searchParams.set('from', params.from);
  if (params.to) url.searchParams.set('to', params.to);
  if (params.limit) url.searchParams.set('limit', params.limit);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Не вдалося отримати замовлення');
  return res.json();
}

export async function fetchTimeline(projectId, orderId) {
  const url = new URL(`/api/orders/${orderId}/timeline`, API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Не вдалося отримати таймлайн');
  return res.json();
}

export async function fetchDicts(projectId) {
  const url = new URL('/api/dicts/statuses', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Не вдалося отримати словники');
  return res.json();
}

export function openOrdersStream(projectId, onMessage) {
  const url = new URL('/api/stream/orders', API_BASE);
  url.searchParams.set('project_id', projectId);
  if (API_TOKEN) url.searchParams.set('token', API_TOKEN);
  const es = new EventSource(url.toString());
  es.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      onMessage?.(data);
    } catch (e) {
      // ignore
    }
  };
  return es;
}

export async function fetchSettingsCycle(projectId) {
  const url = new URL('/api/settings/cycle', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Не вдалося отримати налаштування циклу');
  return res.json();
}

export async function fetchSettingsSLA(projectId) {
  const url = new URL('/api/settings/sla', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Не вдалося отримати SLA');
  return res.json();
}

export async function saveSettingsSLA(projectId, rules) {
  const url = new URL('/api/settings/sla', API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, rules })
  });
  if (!res.ok) throw new Error('Не вдалося зберегти SLA');
  return res.json();
}

export async function saveSettingsCycle(projectId, payload) {
  const url = new URL('/api/settings/cycle', API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, ...payload })
  });
  if (!res.ok) throw new Error('Не вдалося зберегти цикл');
  return res.json();
}
