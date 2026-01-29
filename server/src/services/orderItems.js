import { getProject } from './project.js';
import { loadUrgentRules, isOrderUrgent } from './urgentRules.js';
import { publishOrderUpdate } from '../utils/publish.js';

// simple in-memory queue to avoid parallel fetches for same order
const inFlight = new Set();

export function queueFetchItemsAndUrgent(db, projectId, orderId, redisPub) {
  const key = `${projectId}:${orderId}`;
  if (inFlight.has(key)) return Promise.resolve();
  inFlight.add(key);
  return fetchItemsAndUrgent(db, projectId, orderId, redisPub).finally(() => inFlight.delete(key));
}

async function fetchItemsAndUrgent(db, projectId, orderId, redisPub) {
  const project = await getProject(db, projectId);
  const baseUrl = (project.base_url || process.env.KEYCRM_BASE_URL || '').replace(/\/$/, '');
  const token = project.api_token || process.env.KEYCRM_API_TOKEN;
  if (!baseUrl || !token) throw new Error('missing base_url or api_token for project');

  const url = `${baseUrl}/order/${orderId}?include=products.offer`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  if (!res.ok) {
    throw new Error(`fetch order ${orderId} failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const products = data?.products || [];

  await db.query('BEGIN');
  try {
    await db.query('DELETE FROM order_items WHERE project_id = $1 AND order_id = $2', [projectId, orderId]);
    for (const p of products) {
      await db.query(
        `INSERT INTO order_items (project_id, order_id, offer_id, product_id, sku, name, qty, price_sold, purchased_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          projectId,
          orderId,
          p.offer?.id || p.offer_id || null,
          p.product_id || p.offer?.product_id || null,
          p.sku || p.offer?.sku || null,
          p.name,
          p.quantity || p.qty || 1,
          p.price_sold || p.price || null,
          p.purchased_price || null
        ]
      );
    }

    const rules = await loadUrgentRules(db, projectId);
    const urgent = isOrderUrgent(rules, products);

    await db.query(
      `UPDATE orders_current
       SET is_urgent = $3, updated_at = NOW()
       WHERE project_id = $1 AND order_id = $2`,
      [projectId, orderId, urgent]
    );

    // Publish update
    await publishOrderUpdate(projectId, orderId, { type: 'order_updated', is_urgent: urgent }, redisPub);

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}
