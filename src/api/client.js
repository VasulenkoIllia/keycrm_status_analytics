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
  const handler = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      onMessage?.(data);
    } catch (e) {
      // ignore
    }
  };
  es.onmessage = handler; // default event
  es.addEventListener('order_updated', handler);
  es.addEventListener('invalidate', handler);
  es.addEventListener('message', handler);
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

export async function fetchWorkingHours(projectId) {
  const url = new URL('/api/settings/working-hours', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Не вдалося отримати робочі години');
  return res.json();
}

export async function saveWorkingHours(projectId, rules) {
  const url = new URL('/api/settings/working-hours', API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, rules })
  });
  if (!res.ok) throw new Error('Не вдалося зберегти робочі години');
  return res.json();
}

export async function fetchProjectSettings(projectId) {
  const url = new URL('/api/settings/project', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Не вдалося отримати налаштування проєкту');
  return res.json();
}

export async function saveProjectSettings(projectId, payload) {
  const url = new URL('/api/settings/project', API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, ...payload })
  });
  if (!res.ok) throw new Error('Не вдалося зберегти налаштування проєкту');
  return res.json();
}

export async function fetchUrgentRules(projectId) {
  const url = new URL('/api/settings/urgent-rules', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Не вдалося отримати urgent правила');
  return res.json();
}

export async function saveUrgentRules(projectId, rules) {
  const url = new URL('/api/settings/urgent-rules', API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, rules })
  });
  if (!res.ok) throw new Error('Не вдалося зберегти urgent правила');
  return res.json();
}

export async function fetchOrderOverride(projectId, orderId) {
  const url = new URL(`/api/orders/${orderId}/override`, API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Не вдалося отримати override');
  return res.json();
}

export async function saveOrderOverride(projectId, orderId, payload) {
  const url = new URL(`/api/orders/${orderId}/override`, API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, ...payload })
  });
  if (!res.ok) throw new Error('Не вдалося зберегти override');
  return res.json();
}
