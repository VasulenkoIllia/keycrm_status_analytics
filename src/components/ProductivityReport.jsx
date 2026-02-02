import React, { useMemo, useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Stack,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { fmtDateTime } from '../utils/time';

const ProductivityReport = ({ orders = [], stageLabels = {}, onFetch = () => {}, onOpenOrder = () => {} }) => {
  const [range, setRange] = useState({
    from: dayjs().format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD')
  });
  const [urgentFilter, setUrgentFilter] = useState('all');
  const handleResetRange = () => {
    const today = dayjs().format('YYYY-MM-DD');
    setRange({ from: today, to: today });
  };
  // Підтягувати дані за діапазоном створення
  useEffect(() => {
    onFetch(range.from, range.to);
  }, [range.from, range.to, onFetch]);
  const data = useMemo(() => {
    const filteredByUrgent = orders.filter((o) => {
      if (urgentFilter === 'urgent') return o.is_urgent;
      if (urgentFilter === 'normal') return !o.is_urgent;
      return true;
    });

    const total = filteredByUrgent.length;
    const overdueOrders = filteredByUrgent.filter(
      (o) => o.sla_states && Object.values(o.sla_states).some((s) => s === 'over')
    );
    const overdueCount = overdueOrders.length;
    const overallRate = total ? Math.round((overdueCount / total) * 1000) / 10 : 0;

    const stageTotals = {};
    const stageOver = {};

    orders.forEach((o) => {
      if (!o.sla_states) return;
      Object.entries(o.sla_states).forEach(([gid, state]) => {
        stageTotals[gid] = (stageTotals[gid] || 0) + 1;
        if (state === 'over') {
          stageOver[gid] = (stageOver[gid] || 0) + 1;
        }
      });
    });

    const stageRows = Object.keys({ ...stageTotals, ...stageOver }).map((gid) => {
      const totalStage = stageTotals[gid] || 0;
      const overStage = stageOver[gid] || 0;
      const rate = totalStage ? Math.round((overStage / totalStage) * 1000) / 10 : 0;
      return {
        gid,
        name: stageLabels[gid] || `Етап ${gid}`,
        total: totalStage,
        over: overStage,
        rate
      };
    });

    const overdueTable = overdueOrders.map((o) => {
      const overStage = o.sla_states
        ? Object.entries(o.sla_states).find(([, v]) => v === 'over')
        : null;
      return {
        id: o.order_id,
        stage: overStage ? stageLabels[overStage[0]] || overStage[0] : '—',
        created: o.order_created_at,
        updated: o.last_changed_at
      };
    });

    return { total, overdueCount, overallRate, stageRows, overdueTable };
  }, [orders, stageLabels]);

  return (
    <Card>
      <CardHeader
        title="Звіт продуктивності"
        subheader="Головний KPI: % протермінованих замовлень (будь-який етап) за обраний період"
      />
      <CardContent>
        <Stack spacing={1.5} mb={2}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Stack direction="row" spacing={2} flexWrap="wrap" rowGap={1}>
              <DatePicker
                label="Від"
                value={range.from ? dayjs(range.from) : null}
                onChange={(val) => setRange((p) => ({ ...p, from: val ? val.format('YYYY-MM-DD') : '' }))}
                format="DD.MM.YYYY"
                slotProps={{
                  textField: { size: 'small', sx: { minWidth: 160 } },
                  actionBar: { actions: ['clear', 'today'] }
                }}
              />
              <DatePicker
                label="До"
                value={range.to ? dayjs(range.to) : null}
                onChange={(val) => setRange((p) => ({ ...p, to: val ? val.format('YYYY-MM-DD') : '' }))}
                format="DD.MM.YYYY"
                slotProps={{
                  textField: { size: 'small', sx: { minWidth: 160 } },
                  actionBar: { actions: ['clear', 'today'] }
                }}
              />
            </Stack>
          </LocalizationProvider>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" size="small" onClick={handleResetRange}>
              Скинути фільтр дат
            </Button>
            <Button
              size="small"
              variant={urgentFilter === 'all' ? 'contained' : 'outlined'}
              onClick={() => setUrgentFilter('all')}
            >
              Усі
            </Button>
            <Button
              size="small"
              variant={urgentFilter === 'urgent' ? 'contained' : 'outlined'}
              onClick={() => setUrgentFilter('urgent')}
            >
              Термінові
            </Button>
            <Button
              size="small"
              variant={urgentFilter === 'normal' ? 'contained' : 'outlined'}
              onClick={() => setUrgentFilter('normal')}
            >
              Звичайні
            </Button>
          </Stack>

          <Typography>
            Замовлень: {data.total} • Протерміновані: {data.overdueCount} ({data.overallRate}%)
          </Typography>
          <Typography variant="subtitle2">Етапи (частка протермінованих)</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
            {data.stageRows.map((r) => (
              <Chip
                key={r.gid}
                label={`${r.name}: ${r.rate}% (${r.over}/${r.total})`}
                color={r.rate > 0 ? 'error' : 'success'}
                variant="outlined"
              />
            ))}
          </Stack>
        </Stack>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Протерміновані замовлення (деталі)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Етап з перевищенням</TableCell>
              <TableCell>Створено</TableCell>
              <TableCell>Оновлено</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {data.overdueTable.slice(0, 500).map((r) => (
              <TableRow
                key={r.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => onOpenOrder(orders.find((o) => o.order_id === r.id))}
              >
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.stage}</TableCell>
                <TableCell>{fmtDateTime(r.created)}</TableCell>
                <TableCell>{fmtDateTime(r.updated)}</TableCell>
              </TableRow>
            ))}
            {data.overdueTable.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>Немає протермінованих за вибраний період</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {data.overdueTable.length > 500 && (
          <Typography variant="caption" color="text.secondary">
            Показано 500 з {data.overdueTable.length}. Звузьте період або фільтри.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductivityReport;
