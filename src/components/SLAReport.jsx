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
  Button,
  Chip
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { fmtDateTime } from '../utils/time';

const SLAReport = ({ orders = [], stageLabels = {}, statuses = [], onFetch = () => {}, onOpenOrder = () => {} }) => {
  const [range, setRange] = useState({
    from: dayjs().format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD')
  });
  const [urgentFilter, setUrgentFilter] = useState('all'); // all | urgent | normal

  useEffect(() => {
    onFetch(range.from, range.to);
  }, [range.from, range.to, onFetch]);

  const statusesMap = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.id, s.name])),
    [statuses]
  );

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (urgentFilter === 'urgent' && !o.is_urgent) return false;
      if (urgentFilter === 'normal' && o.is_urgent) return false;
      return true;
    });
  }, [orders, urgentFilter]);

  const resetRange = () => {
    const today = dayjs().format('YYYY-MM-DD');
    setRange({ from: today, to: today });
  };

  const slaColor = (state) => {
    if (state === 'over') return 'error';
    if (state === 'near') return 'warning';
    if (state === 'ok') return 'success';
    return 'default';
  };

  return (
    <Card>
      <CardHeader title="SLA звіт" subheader="Замовлення, етапи та їх SLA-стани" />
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

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Термінове</TableCell>
              <TableCell>Поточний статус</TableCell>
              <TableCell>Створено</TableCell>
              <TableCell>Оновлено</TableCell>
              <TableCell>Етапи (SLA)</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.slice(0, 500).map((o, idx) => (
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
                <TableCell>{o.is_urgent ? 'Так' : 'Ні'}</TableCell>
                <TableCell>{statusesMap[o.last_status_id] || o.last_status_id}</TableCell>
                <TableCell>{fmtDateTime(o.order_created_at)}</TableCell>
                <TableCell>{fmtDateTime(o.last_changed_at)}</TableCell>
                <TableCell>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5}>
                  {o.sla_states
                    ? Object.entries(o.sla_states).map(([gid, st]) => (
                        <Chip
                          key={gid}
                            size="small"
                            color={slaColor(st)}
                            label={`${stageLabels[gid] || gid}: ${st}`}
                            variant="outlined"
                          />
                        ))
                      : <Chip size="small" label="—" />}
                  </Stack>
                </TableCell>
                </TableRow>
              ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>Немає даних за фільтрами</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {filtered.length > 500 && (
          <Typography variant="caption" color="text.secondary">
            Показано 500 з {filtered.length}. Звузьте фільтр.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default SLAReport;
