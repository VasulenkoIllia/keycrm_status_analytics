import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Stack,
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

const isCancelStage = (name = '', gid) => {
  const n = (name || '').toLowerCase();
  if (n.includes('відм') || n.includes('cancel')) return true;
  if (String(gid) === '6') return true;
  return false;
};

const CancellationReport = ({ orders = [], stageLabels = {}, onFetch = () => {}, onOpenOrder = () => {} }) => {
  const [range, setRange] = useState({
    from: dayjs().format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD')
  });
  const [urgentFilter, setUrgentFilter] = useState('all');

  useEffect(() => {
    onFetch(range.from, range.to);
  }, [range.from, range.to, onFetch]);

  const data = useMemo(() => {
    const total = orders.length;
    const filteredUrgent = orders.filter((o) => {
      if (urgentFilter === 'urgent') return o.is_urgent;
      if (urgentFilter === 'normal') return !o.is_urgent;
      return true;
    });
    const canceled = filteredUrgent.filter((o) =>
      isCancelStage(stageLabels[o.last_status_group_id], o.last_status_group_id)
    );
    const rate = total ? Math.round((canceled.length / total) * 1000) / 10 : 0;

    // Розбиття по етапу відміни (звичайно це одна група)
    const byStage = {};
    const previousStageStats = {};
    canceled.forEach((o) => {
      const key = o.last_status_group_id;
      byStage[key] = (byStage[key] || 0) + 1;
      // попередній етап/статус беремо з timeline, останній запис перед cancel
      const tl = o.timeline || [];
      if (tl.length >= 2) {
        const prev = tl[tl.length - 2];
        if (prev) {
          const pgid = prev.group_id;
          const pkey = pgid || 'unknown';
          previousStageStats[pkey] = (previousStageStats[pkey] || 0) + 1;
        }
      }
    });
    const stageRows = Object.entries(byStage).map(([gid, cnt]) => ({
      gid,
      name: stageLabels[gid] || `Етап ${gid}`,
      count: cnt,
      rate: total ? Math.round((cnt / total) * 1000) / 10 : 0
    }));
    const prevStageRows = Object.entries(previousStageStats).map(([gid, cnt]) => ({
      gid,
      name: stageLabels[gid] || `Етап ${gid}`,
      count: cnt,
      rate: total ? Math.round((cnt / total) * 1000) / 10 : 0
    }));

    return { total, canceled, rate, stageRows, prevStageRows };
  }, [orders, stageLabels]);

  const resetRange = () => {
    const today = dayjs().format('YYYY-MM-DD');
    setRange({ from: today, to: today });
  };

  return (
    <Card>
      <CardHeader title="Звіт по відмінених замовленнях" subheader="Дані за датою створення замовлення" />
      <CardContent>
        <Stack direction="row" spacing={2} flexWrap="wrap" rowGap={1} mb={2}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Від"
              value={range.from ? dayjs(range.from) : null}
              onChange={(val) => setRange((p) => ({ ...p, from: val ? val.format('YYYY-MM-DD') : '' }))}
              format="DD.MM.YYYY"
              slotProps={{
                textField: { size: 'small', sx: { minWidth: 150 } },
                actionBar: { actions: ['clear', 'today'] }
              }}
            />
            <DatePicker
              label="До"
              value={range.to ? dayjs(range.to) : null}
              onChange={(val) => setRange((p) => ({ ...p, to: val ? val.format('YYYY-MM-DD') : '' }))}
              format="DD.MM.YYYY"
              slotProps={{
                textField: { size: 'small', sx: { minWidth: 150 } },
                actionBar: { actions: ['clear', 'today'] }
              }}
            />
          </LocalizationProvider>
          <Button variant="outlined" size="small" onClick={resetRange}>
            Скинути дати
          </Button>
          <Stack direction="row" spacing={1}>
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
        </Stack>

        <Typography>
          Замовлень: {data.total} • Відмінені: {data.canceled.length} ({data.rate}%)
        </Typography>
        <Typography variant="subtitle2" sx={{ mt: 1 }}>Етап відміни</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1} mb={2}>
          {data.stageRows.map((r) => (
            <Button key={r.gid} variant="outlined" size="small">
              {r.name}: {r.count} ({r.rate}%)
            </Button>
          ))}
          {data.stageRows.length === 0 && (
            <Typography variant="body2" color="text.secondary">Відмін не знайдено за період</Typography>
          )}
        </Stack>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>Попередній етап перед відміною</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1} mb={2}>
          {data.prevStageRows.map((r) => (
            <Button key={r.gid} variant="outlined" size="small">
              {r.name}: {r.count} ({r.rate}%)
            </Button>
          ))}
          {data.prevStageRows.length === 0 && (
            <Typography variant="body2" color="text.secondary">Немає даних про попередній етап</Typography>
          )}
        </Stack>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Список відмінених замовлень
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Етап відміни</TableCell>
              <TableCell>Попередній етап / статус</TableCell>
              <TableCell>Створено</TableCell>
              <TableCell>Оновлено</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {data.canceled.slice(0, 500).map((o, idx) => (
              <TableRow
                key={o.order_id}
                hover
                sx={{
                  cursor: 'pointer',
                  backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)'
                }}
                onClick={() => onOpenOrder(o)}
              >
                <TableCell>{o.order_id}</TableCell>
                <TableCell>{stageLabels[o.last_status_group_id] || o.last_status_group_id}</TableCell>
                <TableCell>
                  {(() => {
                    const tl = o.timeline || [];
                    if (tl.length >= 2) {
                      const prev = tl[tl.length - 2];
                      const name = stageLabels[prev.group_id] || prev.stage || prev.group_id;
                      return `${name} / ${prev.status || prev.status_id || ''}`;
                    }
                    return '—';
                  })()}
                </TableCell>
                <TableCell>{fmtDateTime(o.order_created_at)}</TableCell>
                <TableCell>{fmtDateTime(o.last_changed_at)}</TableCell>
              </TableRow>
            ))}
            {data.canceled.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>Немає відмінених замовлень за період</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {data.canceled.length > 500 && (
          <Typography variant="caption" color="text.secondary">
            Показано 500 з {data.canceled.length}. Звузьте період.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default CancellationReport;
