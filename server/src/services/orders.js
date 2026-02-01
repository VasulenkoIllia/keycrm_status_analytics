// SQL helpers for orders list and timeline

const timelineSql = `
SELECT project_id, order_id, status_id, status_group_id,
       status_changed_at AS entered_at,
       LEAD(status_changed_at) OVER (PARTITION BY project_id, order_id ORDER BY status_changed_at) AS left_at
FROM order_status_events
WHERE project_id = $1 AND order_id = $2
ORDER BY status_changed_at ASC;
`;

// Utility: parse "HH:MM" to seconds from midnight
function timeToSeconds(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 3600 + m * 60;
}

// Utility: build working hours map { groupId: { weekday: [{startSec,endSec}...] } }
function buildWorkingMap(rows) {
  const map = new Map();
  for (const r of rows) {
    const g = Number(r.group_id);
    if (!map.has(g)) map.set(g, {});
    const weekday = Number(r.weekday);
    const ranges = Array.isArray(r.ranges)
      ? r.ranges.map((rng) => ({
          start: timeToSeconds(rng.start),
          end: timeToSeconds(rng.end)
        }))
      : [];
    map.get(g)[weekday] = ranges; // may be empty => day off
  }
  return map;
}

// Get ranges for group/weekday, default 24/7; empty array means day off
function rangesFor(map, groupId, weekday) {
  const byGroup = map.get(groupId);
  if (byGroup && Object.prototype.hasOwnProperty.call(byGroup, weekday)) return byGroup[weekday];
  // default: full day
  return [{ start: 0, end: 24 * 3600 }];
}

// Convert JS getUTCDay (0=Sun) to our weekday (0=Mon..6=Sun)
function dayIndex(jsUtcDay) {
  return (jsUtcDay + 6) % 7;
}

function overlap(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

function workingSecondsForInterval(start, end, groupId, workingMap) {
  let total = 0;
  let cursor = new Date(start);
  const endDate = new Date(end);
  while (cursor < endDate) {
    const dayStart = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate());
    const dayEnd = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1);
    const sliceEnd = Math.min(dayEnd, endDate.getTime());
    const weekday = dayIndex(cursor.getUTCDay());
    const ranges = rangesFor(workingMap, groupId, weekday);
    const fromSec = (cursor.getTime() - dayStart) / 1000;
    const toSec = (sliceEnd - dayStart) / 1000;
    for (const r of ranges) {
      total += overlap(fromSec, toSec, r.start, r.end);
    }
    cursor = new Date(sliceEnd);
  }
  return total;
}

function sumWorkingForWindow(events, startAt, endAt, workingMap) {
  let total = 0;
  for (const ev of events) {
    const entered = new Date(ev.entered_at);
    const left = new Date(ev.left_at || Date.now());
    const intervalStart = entered > startAt ? entered : startAt;
    const intervalEnd = left < endAt ? left : endAt;
    if (intervalStart < intervalEnd) {
      total += workingSecondsForInterval(intervalStart, intervalEnd, ev.status_group_id, workingMap);
    }
  }
  return total;
}

export async function getOrdersList(db, projectId, { from = null, to = null, limit = 50 } = {}) {
  // 1) pick orders
  const ordersRes = await db.query(
    `SELECT project_id, order_id, last_status_id, last_status_group_id, last_changed_at, is_urgent, started_at
     FROM orders_current
     WHERE project_id = $1
       AND ($2::timestamptz IS NULL OR started_at >= $2)
       AND ($3::timestamptz IS NULL OR started_at <= $3)
     ORDER BY last_changed_at DESC
     LIMIT $4`,
    [projectId, from, to, limit]
  );
  const orders = ordersRes.rows;
  if (!orders.length) return [];
  const orderIds = orders.map((o) => o.order_id);

  // 2) events intervals for selected orders (with optional date filter)
  const eventsRes = await db.query(
    `
    SELECT project_id, order_id, status_id, status_group_id,
           status_changed_at AS entered_at,
           LEAD(status_changed_at) OVER (PARTITION BY project_id, order_id ORDER BY status_changed_at) AS left_at
    FROM order_status_events
    WHERE project_id = $1
      AND order_id = ANY($2)
    ORDER BY order_id, entered_at
    `,
    [projectId, orderIds]
  );
  const events = eventsRes.rows;

  // 3) cycle rule
  const cycleRes = await db.query(
    `SELECT cr.id, cr.start_group_id, cr.start_status_id, cr.end_group_id, cr.end_status_id
     FROM project_settings ps
     JOIN cycle_rules cr ON cr.id = ps.default_cycle_id
     WHERE ps.project_id = $1
     LIMIT 1`,
    [projectId]
  );
  const cycleRule = cycleRes.rows[0] || null;

  // 4) SLA rules
  const slaRes = await db.query(
    `SELECT group_id, is_urgent, limit_hours
     FROM sla_stage_rules
     WHERE project_id = $1`,
    [projectId]
  );

  // 5) working hours
  const whRes = await db.query(
    `SELECT group_id, weekday, ranges
     FROM working_hours
     WHERE project_id = $1`,
    [projectId]
  );
  const workingMap = buildWorkingMap(whRes.rows);

  // helper to get SLA limit for group and urgency
  const slaMap = new Map();
  for (const r of slaRes.rows) {
    slaMap.set(`${r.group_id}:${r.is_urgent ? 1 : 0}`, Number(r.limit_hours));
  }
  const getLimit = (groupId, isUrgent) => slaMap.get(`${groupId}:${isUrgent ? 1 : 0}`) ?? null;

  // build events per order
  const eventsByOrder = new Map();
  for (const ev of events) {
    if (!eventsByOrder.has(ev.order_id)) eventsByOrder.set(ev.order_id, []);
    eventsByOrder.get(ev.order_id).push(ev);
  }

  const now = new Date();

  return orders.map((o) => {
    const evs = eventsByOrder.get(o.order_id) || [];
    const stageSeconds = {};
    for (const ev of evs) {
      const left = ev.left_at ? new Date(ev.left_at) : now;
      const sec = workingSecondsForInterval(new Date(ev.entered_at), left, ev.status_group_id, workingMap);
      stageSeconds[ev.status_group_id] = (stageSeconds[ev.status_group_id] || 0) + sec;
    }

    // cycle detection
    let startAt = null;
    let endAt = null;
    if (cycleRule) {
      for (const ev of evs) {
        if (!startAt &&
          ((cycleRule.start_group_id && ev.status_group_id === cycleRule.start_group_id) ||
            (cycleRule.start_status_id && ev.status_id === cycleRule.start_status_id))) {
          startAt = new Date(ev.entered_at);
        }
        if (!endAt &&
          ((cycleRule.end_group_id && ev.status_group_id === cycleRule.end_group_id) ||
            (cycleRule.end_status_id && ev.status_id === cycleRule.end_status_id))) {
          endAt = new Date(ev.entered_at);
        }
        if (startAt && endAt) break;
      }
    }

    let cycleSeconds = null;
    if (startAt && endAt && endAt > startAt) {
      cycleSeconds = sumWorkingForWindow(evs, startAt, endAt, workingMap);
    }

    // SLA states
    const slaStates = {};
    Object.entries(stageSeconds).forEach(([gid, seconds]) => {
      const limit = getLimit(Number(gid), o.is_urgent);
      if (!limit) {
        slaStates[gid] = 'neutral';
      } else if (seconds > limit * 3600) {
        slaStates[gid] = 'over';
      } else if (seconds >= limit * 3600 * 0.8) {
        slaStates[gid] = 'near';
      } else {
        slaStates[gid] = 'ok';
      }
    });

    return {
      project_id: o.project_id,
      order_id: o.order_id,
      last_status_id: o.last_status_id,
      last_status_group_id: o.last_status_group_id,
      last_changed_at: o.last_changed_at,
      is_urgent: o.is_urgent,
      stage_seconds: stageSeconds,
      sla_states: slaStates,
      start_at: startAt,
      end_at: endAt,
      cycle_seconds: cycleSeconds
    };
  });
}

export async function getOrderTimeline(db, projectId, orderId) {
  const res = await db.query(timelineSql, [projectId, orderId]);
  return res.rows.map((r) => ({
    status_id: r.status_id,
    status_group_id: r.status_group_id,
    entered_at: r.entered_at,
    left_at: r.left_at
  }));
}
