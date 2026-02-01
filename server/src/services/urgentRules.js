export async function loadUrgentRules(db, projectId) {
  const res = await db.query(
    'SELECT rule_name, match_type, match_value FROM urgent_rules WHERE project_id = $1 AND is_active = TRUE',
    [projectId]
  );
  return res.rows;
}

export function isOrderUrgent(rules, products) {
  if (!rules.length || !products?.length) return { urgent: false, rule: null };
  for (const rule of rules) {
    for (const p of products) {
      if (rule.match_type === 'sku' && p.sku === rule.match_value) return { urgent: true, rule: rule.rule_name || rule.match_value };
      if (rule.match_type === 'offer_id' && String(p.offer_id || p.offer?.id) === rule.match_value) return { urgent: true, rule: rule.rule_name || rule.match_value };
      if (rule.match_type === 'product_id' && String(p.product_id || p.product?.id) === rule.match_value) return { urgent: true, rule: rule.rule_name || rule.match_value };
    }
  }
  return { urgent: false, rule: null };
}

// Recalculate is_urgent / urgent_rule for all orders of project based on current rules and order_items
export async function recomputeUrgentForProject(db, projectId) {
  // reset
  await db.query('UPDATE orders_current SET is_urgent = FALSE, urgent_rule = NULL, updated_at = NOW() WHERE project_id = $1', [projectId]);

  await db.query(
    `
    UPDATE orders_current oc
    SET is_urgent = TRUE,
        urgent_rule = sub.rule_name,
        updated_at = NOW()
    FROM (
      SELECT i.order_id, MIN(r.rule_name) AS rule_name
      FROM order_items i
      JOIN urgent_rules r
        ON r.project_id = i.project_id
       AND r.is_active = TRUE
       AND (
         (r.match_type = 'sku' AND i.sku = r.match_value) OR
         (r.match_type = 'offer_id' AND CAST(i.offer_id AS text) = r.match_value) OR
         (r.match_type = 'product_id' AND CAST(i.product_id AS text) = r.match_value)
       )
      WHERE i.project_id = $1
      GROUP BY i.order_id
    ) sub
    WHERE oc.project_id = $1 AND oc.order_id = sub.order_id
    `,
    [projectId]
  );
}
