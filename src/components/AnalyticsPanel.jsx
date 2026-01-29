import React from 'react';
import { Card, CardContent, Grid, Typography, Stack, Chip } from '@mui/material';
import { formatDuration } from '../utils/time';

const fmtHours = (sec) => (sec ? (sec / 3600).toFixed(1) + ' год' : '—');

export const AnalyticsPanel = ({ orders = [], stageLabels = {} }) => {
  if (!orders.length) return null;

  const totalOrders = orders.length;
  const totalCycleSec = orders.reduce((s, o) => s + (o.cycle_seconds || 0), 0);
  const avgCycleSec = totalCycleSec / totalOrders || 0;

  const stageTotals = {};
  orders.forEach((o) => {
    if (o.stage_seconds) {
      Object.entries(o.stage_seconds).forEach(([g, sec]) => {
        stageTotals[g] = (stageTotals[g] || 0) + sec;
      });
    }
  });

  const urgentCount = orders.filter((o) => o.is_urgent).length;
  const slaOk = orders.filter((o) => o.sla_states && Object.values(o.sla_states).every((s) => s === 'ok')).length;

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">Замовлень</Typography>
            <Typography variant="h5">{totalOrders}</Typography>
            <Typography variant="caption" color="text.secondary">Термінові: {urgentCount}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">Середній цикл</Typography>
            <Typography variant="h5">{formatDuration(avgCycleSec)}</Typography>
            <Typography variant="caption" color="text.secondary">Сумарно: {fmtHours(totalCycleSec)}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">SLA OK</Typography>
            <Typography variant="h5">{slaOk}</Typography>
            <Typography variant="caption" color="text.secondary">із {totalOrders}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">Час по етапах</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
              {Object.entries(stageTotals).map(([g, sec]) => (
                <Chip key={g} size="small" label={`${stageLabels[Number(g)] || g}: ${fmtHours(sec)}`} />
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default AnalyticsPanel;
