export async function publishOrderUpdate(projectId, orderId, payload = {}, redisPub) {
  // redisPub optional, we will fetch from app if missing
  const msg = {
    type: payload.type || 'order_updated',
    project_id: projectId,
    order_id: orderId,
    ...payload
  };

  if (redisPub) {
    try {
      await redisPub.publish('orders-stream', JSON.stringify(msg));
    } catch (e) {
      // fallback: log and ignore
      // eslint-disable-next-line no-console
      if (process.env.LOG_LEVEL === 'debug') console.error('publishOrderUpdate redis error', e.message);
    }
    return;
  }

  // Fallback: no redis passed; do nothing
  return Promise.resolve();
}
