import React from 'react';
import { Card, CardContent, Grid, Typography, Stack, Chip, LinearProgress, Box } from '@mui/material';
import { formatDuration } from '../utils/time';

const fmtHours = (sec = 0) => formatDuration(sec || 0);

export const AnalyticsPanel = ({ orders = [], stageLabels = {} }) => {
  if (!orders.length) return null;

  const totalOrders = orders.length;
  const cycles = orders.map((o) => o.cycle_seconds || 0).filter((v) => v > 0).sort((a, b) => a - b);
  const totalCycleSec = cycles.reduce((s, v) => s + v, 0);
  const avgCycleSec = totalCycleSec / (cycles.length || 1);

  const percentile = (arr, p) => {
    if (!arr.length) return 0;
    const idx = (arr.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return arr[lo];
    return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
  };

  const medianCycle = percentile(cycles, 0.5);
  const p95Cycle = percentile(cycles, 0.95);

  const stageTotals = {};
  const stageCalendar = {};
  orders.forEach((o) => {
    if (o.stage_seconds) {
      Object.entries(o.stage_seconds).forEach(([g, sec]) => {
        stageTotals[g] = (stageTotals[g] || 0) + sec;
      });
    }
    if (o.stage_calendar_seconds) {
      Object.entries(o.stage_calendar_seconds).forEach(([g, sec]) => {
        stageCalendar[g] = (stageCalendar[g] || 0) + sec;
      });
    }
  });
  const totalWorking = Object.values(stageTotals).reduce((s, v) => s + v, 0);
  const totalCalendar = Object.values(stageCalendar).reduce((s, v) => s + v, 0);

  const urgentCount = orders.filter((o) => o.is_urgent).length;
  const normalCount = totalOrders - urgentCount;

  const getOrderSlaState = (o) => {
    if (!o.sla_states) return 'neutral';
    const vals = Object.values(o.sla_states);
    if (vals.some((v) => v === 'over')) return 'over';
    if (vals.some((v) => v === 'near')) return 'near';
    if (vals.some((v) => v === 'ok')) return 'ok';
    return 'neutral';
  };

  let slaOk = 0;
  let slaNear = 0;
  let slaOver = 0;
  orders.forEach((o) => {
    const st = getOrderSlaState(o);
    if (st === 'over') slaOver += 1;
    else if (st === 'near') slaNear += 1;
    else if (st === 'ok') slaOk += 1;
  });

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">Замовлень</Typography>
            <Typography variant="h5">{totalOrders}</Typography>
            <Typography variant="caption" color="text.secondary">Термінові: {urgentCount} • Звичайні: {normalCount}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">Середній цикл</Typography>
            <Typography variant="h5">{formatDuration(avgCycleSec)}</Typography>
            <Typography variant="caption" color="text.secondary">Медіана: {formatDuration(medianCycle)} | P95: {formatDuration(p95Cycle)}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">Сумарно: {fmtHours(totalCycleSec)}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">SLA</Typography>
            <Typography variant="body2">OK: {slaOk} | Near: {slaNear} | Over: {slaOver}</Typography>
            <LinearProgress
              variant="determinate"
              value={(slaOk / totalOrders) * 100}
              sx={{ mt: 1.5 }}
            />
            <Typography variant="caption" color="text.secondary">OK частка: {Math.round((slaOk / totalOrders) * 100)}%</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default AnalyticsPanel;
