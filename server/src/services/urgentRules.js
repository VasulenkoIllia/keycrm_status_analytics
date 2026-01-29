export async function loadUrgentRules(db, projectId) {
  const res = await db.query(
    'SELECT match_type, match_value FROM urgent_rules WHERE project_id = $1 AND is_active = TRUE',
    [projectId]
  );
  return res.rows;
}

export function isOrderUrgent(rules, products) {
  if (!rules.length || !products?.length) return false;
  for (const rule of rules) {
    for (const p of products) {
      if (rule.match_type === 'sku' && p.sku === rule.match_value) return true;
      if (rule.match_type === 'offer_id' && String(p.offer_id || p.offer?.id) === rule.match_value) return true;
      if (rule.match_type === 'product_id' && String(p.product_id || p.product?.id) === rule.match_value) return true;
    }
  }
  return false;
}
