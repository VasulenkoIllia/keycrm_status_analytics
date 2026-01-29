// SQL helpers for orders list and timeline

export async function getOrdersList(db, projectId, { from = null, to = null, limit = 50 } = {}) {
  const res = await db.query(`
WITH ev AS (
  SELECT *
  FROM order_status_events
  WHERE project_id = $1
    AND ($2::timestamptz IS NULL OR status_changed_at >= $2)
    AND ($3::timestamptz IS NULL OR status_changed_at <= $3)
),
intervals AS (
  SELECT project_id, order_id, status_id, status_group_id,
         status_changed_at AS entered_at,
         LEAD(status_changed_at) OVER (PARTITION BY project_id, order_id ORDER BY status_changed_at) AS left_at
  FROM ev
),
durations AS (
  SELECT project_id, order_id, status_group_id,
         SUM(EXTRACT(EPOCH FROM (COALESCE(left_at, NOW()) - entered_at))) AS seconds
  FROM intervals
  GROUP BY project_id, order_id, status_group_id
),
cycle AS (
  SELECT cr.id AS cycle_rule_id, cr.start_group_id, cr.start_status_id, cr.end_group_id, cr.end_status_id
  FROM project_settings ps
  JOIN cycle_rules cr ON cr.id = ps.default_cycle_id
  WHERE ps.project_id = $1
  LIMIT 1
),
cycle_times AS (
  SELECT i.project_id, i.order_id,
         MIN(CASE WHEN (c.start_group_id IS NOT NULL AND i.status_group_id = c.start_group_id)
                   OR (c.start_status_id IS NOT NULL AND i.status_id = c.start_status_id)
                  THEN i.entered_at END) AS start_at,
         MIN(CASE WHEN (c.end_group_id IS NOT NULL AND i.status_group_id = c.end_group_id)
                   OR (c.end_status_id IS NOT NULL AND i.status_id = c.end_status_id)
                  THEN i.entered_at END) AS end_at,
         c.cycle_rule_id
  FROM intervals i
  CROSS JOIN cycle c
  GROUP BY i.project_id, i.order_id, c.cycle_rule_id
),
sla_ok AS (
  SELECT s.project_id, s.group_id, s.is_urgent, s.limit_hours FROM sla_stage_rules s WHERE s.project_id = $1
)
SELECT oc.project_id, oc.order_id,
       oc.last_status_id, oc.last_status_group_id, oc.last_changed_at,
       oc.is_urgent,
       jsonb_object_agg(d.status_group_id::text, d.seconds) FILTER (WHERE d.status_group_id IS NOT NULL) AS stage_seconds,
       jsonb_object_agg(s.group_id::text,
         CASE
           WHEN d.seconds IS NULL OR s.limit_hours IS NULL THEN 'neutral'
           WHEN d.seconds > s.limit_hours*3600 THEN 'over'
           WHEN d.seconds >= s.limit_hours*3600*0.8 THEN 'near'
           ELSE 'ok'
         END
       ) FILTER (WHERE s.group_id IS NOT NULL) AS sla_states,
       ct.start_at, ct.end_at,
       EXTRACT(EPOCH FROM (ct.end_at - ct.start_at)) AS cycle_seconds
FROM orders_current oc
LEFT JOIN durations d ON d.project_id = oc.project_id AND d.order_id = oc.order_id
LEFT JOIN sla_ok s ON s.project_id = oc.project_id AND s.is_urgent = COALESCE(oc.is_urgent, FALSE) AND s.group_id = d.status_group_id
LEFT JOIN cycle_times ct ON ct.project_id = oc.project_id AND ct.order_id = oc.order_id
WHERE oc.project_id = $1
GROUP BY oc.project_id, oc.order_id, oc.last_status_id, oc.last_status_group_id, oc.last_changed_at, oc.is_urgent, ct.start_at, ct.end_at
ORDER BY oc.last_changed_at DESC
LIMIT $4;
`, [projectId, from, to, limit]);
  return res.rows;
}

const timelineSql = `
SELECT project_id, order_id, status_id, status_group_id,
       status_changed_at AS entered_at,
       LEAD(status_changed_at) OVER (PARTITION BY project_id, order_id ORDER BY status_changed_at) AS left_at
FROM order_status_events
WHERE project_id = $1 AND order_id = $2
ORDER BY status_changed_at ASC;
`;

export async function getOrderTimeline(db, projectId, orderId) {
  const res = await db.query(timelineSql, [projectId, orderId]);
  return res.rows.map((r) => ({
    status_id: r.status_id,
    status_group_id: r.status_group_id,
    entered_at: r.entered_at,
    left_at: r.left_at
  }));
}
