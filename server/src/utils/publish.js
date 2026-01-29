export async function publishOrderUpdate(projectId, orderId, payload = {}, redisPub) {
  // redisPub optional, we will fetch from app if missing
  const msg = {
    type: payload.type || 'order_updated',
    project_id: projectId,
    order_id: orderId,
    ...payload
  };

  if (redisPub) {
    return redisPub.publish('orders-stream', JSON.stringify(msg));
  }

  // Fallback: no redis passed; do nothing
  return Promise.resolve();
}
