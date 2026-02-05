let API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
let API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

export const setApiToken = (token) => {
  API_TOKEN = token || '';
};

export const setApiBase = (base) => {
  if (base) API_BASE = base.replace(/\/$/, '');
};

const authHeaders = () => (API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {});

const handle = async (res, msg) => {
  if (res.status === 401) {
    const err = new Error('auth');
    err.code = 401;
    throw err;
  }
  if (!res.ok) throw new Error(msg);
  return res.json();
};

export async function login(username, password) {
  const url = new URL('/api/login', API_BASE);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await handle(res, 'Невірний логін або пароль');
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
  return handle(res, 'Не вдалося отримати замовлення');
}

export async function fetchTimeline(projectId, orderId) {
  const url = new URL(`/api/orders/${orderId}/timeline`, API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати таймлайн');
}

export async function fetchDicts(projectId) {
  const url = new URL('/api/dicts/statuses', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати словники');
}

export function openOrdersStream(projectId, onMessage, onFatalError) {
  let es = null;
  let stopped = false;
  let retry = 1000;
  let failCount = 0;
  const MAX_FAILS = 5;

  const connect = () => {
    if (stopped) return;
    const url = new URL('/api/stream/orders', API_BASE);
    url.searchParams.set('project_id', projectId);
    if (API_TOKEN) url.searchParams.set('token', API_TOKEN);
    es = new EventSource(url.toString());

    const handler = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        retry = 1000; // успішне повідомлення — скидаємо бекоф
        failCount = 0;
        onMessage?.(data);
      } catch (e) {
        // ignore
      }
    };

    es.onmessage = handler;
    es.addEventListener('order_updated', handler);
    es.addEventListener('invalidate', handler);
    es.addEventListener('message', handler);

    es.onerror = () => {
      if (stopped) return;
      failCount += 1;
      es.close();
      if (failCount >= MAX_FAILS) {
        stopped = true;
        onFatalError?.(new Error('SSE disconnected'));
        return;
      }
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 30000);
    };
  };

  connect();

  return {
    close() {
      stopped = true;
      if (es) es.close();
    }
  };
}

export async function fetchSettingsCycle(projectId) {
  const url = new URL('/api/settings/cycle', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати налаштування циклу');
}

export async function fetchSettingsSLA(projectId) {
  const url = new URL('/api/settings/sla', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати SLA');
}

export async function saveSettingsSLA(projectId, payload) {
  const url = new URL('/api/settings/sla', API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, ...payload })
  });
  return handle(res, 'Не вдалося зберегти SLA');
}

export async function saveSettingsCycle(projectId, payload) {
  const url = new URL('/api/settings/cycle', API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, ...payload })
  });
  return handle(res, 'Не вдалося зберегти цикл');
}

export async function fetchWorkingHours(projectId) {
  const url = new URL('/api/settings/working-hours', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати робочі години');
}

export async function saveWorkingHours(projectId, rules) {
  const url = new URL('/api/settings/working-hours', API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, rules })
  });
  return handle(res, 'Не вдалося зберегти робочі години');
}

export async function fetchProjectSettings(projectId) {
  const url = new URL('/api/settings/project', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати налаштування проєкту');
}

export async function saveProjectSettings(projectId, payload) {
  const url = new URL('/api/settings/project', API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, ...payload })
  });
  return handle(res, 'Не вдалося зберегти налаштування проєкту');
}

export async function fetchUrgentRules(projectId) {
  const url = new URL('/api/settings/urgent-rules', API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати urgent правила');
}

export async function saveUrgentRules(projectId, rules) {
  const url = new URL('/api/settings/urgent-rules', API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, rules })
  });
  return handle(res, 'Не вдалося зберегти urgent правила');
}

export async function fetchWebhookStats() {
  const url = new URL('/api/settings/webhook-stats', API_BASE);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати стан вебхука');
}

export async function fetchOrderOverride(projectId, orderId) {
  const url = new URL(`/api/orders/${orderId}/override`, API_BASE);
  url.searchParams.set('project_id', projectId);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати override');
}

export async function saveOrderOverride(projectId, orderId, payload) {
  const url = new URL(`/api/orders/${orderId}/override`, API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ project_id: projectId, ...payload })
  });
  return handle(res, 'Не вдалося зберегти override');
}

export async function fetchProjects() {
  const url = new URL('/api/projects', API_BASE);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати проєкти');
}

// --- Users & access management ---
export async function fetchUsers() {
  const url = new URL('/api/users', API_BASE);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати користувачів');
}

export async function createUser(payload) {
  const url = new URL('/api/users', API_BASE);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  return handle(res, 'Не вдалося створити користувача');
}

export async function updateUser(id, payload) {
  const url = new URL(`/api/users/${id}`, API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  return handle(res, 'Не вдалося оновити користувача');
}

export async function updateUserPassword(id, password) {
  const url = new URL(`/api/users/${id}/password`, API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ password })
  });
  return handle(res, 'Не вдалося змінити пароль');
}

export async function fetchUserProjects(id) {
  const url = new URL(`/api/users/${id}/projects`, API_BASE);
  const res = await fetch(url, { headers: { ...authHeaders() } });
  return handle(res, 'Не вдалося отримати доступи користувача');
}

export async function updateUserProjects(id, projects) {
  const url = new URL(`/api/users/${id}/projects`, API_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ projects })
  });
  return handle(res, 'Не вдалося оновити доступи користувача');
}
