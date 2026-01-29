import { queueFetchItemsAndUrgent } from './orderItems.js';
import { publishOrderUpdate } from '../utils/publish.js';

function buildDedup(projectId, ctx) {
  return `${projectId}:${ctx.id}:${ctx.status_id}:${ctx.status_changed_at}`;
}

export async function handleWebhook(db, redisPub, projectIdInput, body) {
  const projectId = Number(projectIdInput);
  if (!Number.isInteger(projectId)) throw new Error('invalid project id');
  if (!body?.context) throw new Error('no context');
  const ctx = body.context;

  const dedup = buildDedup(projectId, ctx);

  await db.query('BEGIN');
  try {
    await db.query(
      `INSERT INTO order_status_events
       (project_id, order_id, status_id, status_group_id, status_changed_at, order_created_at, payload, dedup_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT DO NOTHING`,
      [
        projectId,
        ctx.id,
        ctx.status_id,
        ctx.status_group_id,
        ctx.status_changed_at,
        ctx.created_at || ctx.ordered_at || null,
        body,
        dedup
      ]
    );

    // update orders_current basic fields
    await db.query(
      `INSERT INTO orders_current (project_id, order_id, started_at, last_status_id, last_status_group_id, last_changed_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (project_id, order_id) DO UPDATE
         SET last_status_id = EXCLUDED.last_status_id,
             last_status_group_id = EXCLUDED.last_status_group_id,
             last_changed_at = EXCLUDED.last_changed_at,
             updated_at = NOW(),
             started_at = COALESCE(orders_current.started_at, EXCLUDED.started_at)`,
      [
        projectId,
        ctx.id,
        ctx.created_at || ctx.ordered_at || ctx.status_changed_at,
        ctx.status_id,
        ctx.status_group_id,
        ctx.status_changed_at
      ]
    );

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }

  // Fire-and-forget: підвантажити товари і визначити is_urgent
  queueFetchItemsAndUrgent(db, projectId, ctx.id, redisPub).catch((err) => {
    console.error('fetch items failed', err.message);
  });

  publishOrderUpdate(projectId, ctx.id, { type: 'order_updated', status_id: ctx.status_id, status_group_id: ctx.status_group_id }, redisPub).catch(() => {});
}
