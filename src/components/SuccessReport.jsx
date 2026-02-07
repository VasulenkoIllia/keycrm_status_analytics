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
  TableSortLabel,
  TablePagination,
  Button,
  Chip
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { fmtDateTime, formatDuration } from '../utils/time';

const isCancelStage = (name = '', gid) => {
  const n = (name || '').toLowerCase();
  if (n.includes('відм') || n.includes('cancel')) return true;
  if (String(gid) === '6') return true;
  return false;
};

const SuccessReport = ({ orders = [], stageLabels = {}, onFetch = () => {}, onOpenOrder = () => {} }) => {
  const [range, setRange] = useState({
    from: dayjs().format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD')
  });
  const [stateFilter, setStateFilter] = useState('all'); // all | ontime | over
  const [urgentFilter, setUrgentFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'updated', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  useEffect(() => {
    onFetch(range.from, range.to);
  }, [range.from, range.to, onFetch]);

  const filtered = useMemo(() => {
    // успішні = не відмінені
    const urgentFiltered = orders.filter((o) => {
      if (urgentFilter === 'urgent') return o.is_urgent;
      if (urgentFilter === 'normal') return !o.is_urgent;
      return true;
    });

    const nonCancelled = urgentFiltered.filter(
      (o) => !isCancelStage(stageLabels[o.last_status_group_id], o.last_status_group_id)
    );
    if (stateFilter === 'ontime') {
      return nonCancelled.filter(
        (o) => !(o.sla_states && Object.values(o.sla_states).some((s) => s === 'over'))
      );
    }
    if (stateFilter === 'over') {
      return nonCancelled.filter(
        (o) => o.sla_states && Object.values(o.sla_states).some((s) => s === 'over')
      );
    }
    return nonCancelled;
  }, [orders, stageLabels, stateFilter, urgentFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const dir = sort.dir === 'asc' ? 1 : -1;
    const slaScore = (o) =>
      o.sla_states && Object.values(o.sla_states).some((s) => s === 'over')
        ? 3
        : o.sla_states && Object.values(o.sla_states).some((s) => s === 'near')
        ? 2
        : 1;
    const calendarTotal = (o) =>
      o.stage_calendar_seconds ? Object.values(o.stage_calendar_seconds).reduce((s, v) => s + (v || 0), 0) : 0;
    const getValue = (o) => {
      switch (sort.key) {
        case 'id':
          return o.order_id || 0;
        case 'stage':
          return stageLabels[o.last_status_group_id] || String(o.last_status_group_id || '');
        case 'created':
          return o.order_created_at ? new Date(o.order_created_at).getTime() : null;
        case 'updated':
          return o.last_changed_at ? new Date(o.last_changed_at).getTime() : null;
        case 'work':
          return o.cycle_seconds || 0;
        case 'calendar':
          return calendarTotal(o);
        case 'sla':
          return slaScore(o);
        default:
          return 0;
      }
    };
    const compare = (a, b) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      if (typeof a === 'string' || typeof b === 'string') {
        return String(a).localeCompare(String(b), 'uk', { numeric: true, sensitivity: 'base' });
      }
      return a - b;
    };
    rows.sort((a, b) => compare(getValue(a), getValue(b)) * dir);
    return rows;
  }, [filtered, sort, stageLabels]);

  useEffect(() => {
    if (page > 0 && page * rowsPerPage >= sorted.length) setPage(0);
  }, [sorted.length, page, rowsPerPage]);

  const toggleSort = (key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const headCellSx = { fontWeight: 700 };
  const sortLabel = (key, label) => (
    <TableSortLabel
      active={sort.key === key}
      direction={sort.key === key ? sort.dir : 'asc'}
      onClick={() => toggleSort(key)}
      sx={{ fontWeight: 700 }}
    >
      {label}
    </TableSortLabel>
  );
  const paged = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const stats = useMemo(() => {
    const total = filtered.length;
    const onTime = filtered.filter(
      (o) => !(o.sla_states && Object.values(o.sla_states).some((s) => s === 'over'))
    ).length;
    const onTimeRate = total ? Math.round((onTime / total) * 1000) / 10 : 0;

    const avgWork =
      total === 0
        ? 0
        : filtered.reduce((s, o) => s + (o.cycle_seconds || 0), 0) / total;
    const avgCal =
      total === 0
        ? 0
        : filtered.reduce(
            (s, o) =>
              s +
              (o.stage_calendar_seconds
                ? Object.values(o.stage_calendar_seconds).reduce((p, v) => p + (v || 0), 0)
                : 0),
            0
          ) / total;

    // етапи з протермінуваннями
    const overByStage = {};
    filtered.forEach((o) => {
      if (!o.sla_states) return;
      Object.entries(o.sla_states).forEach(([gid, st]) => {
        if (st === 'over') overByStage[gid] = (overByStage[gid] || 0) + 1;
      });
    });

    return { total, onTime, onTimeRate, avgWork, avgCal, overByStage };
  }, [filtered]);

  const resetRange = () => {
    const today = dayjs().format('YYYY-MM-DD');
    setRange({ from: today, to: today });
  };

  return (
    <Card>
      <CardHeader title="Звіт успішності" subheader="Дата фільтра — створення замовлення" />
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
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant={stateFilter === 'all' ? 'contained' : 'outlined'}
              onClick={() => setStateFilter('all')}
            >
              Усі успішні
            </Button>
            <Button
              size="small"
              variant={stateFilter === 'ontime' ? 'contained' : 'outlined'}
              onClick={() => setStateFilter('ontime')}
            >
              Вчасно
            </Button>
            <Button
              size="small"
              variant={stateFilter === 'over' ? 'contained' : 'outlined'}
              onClick={() => setStateFilter('over')}
            >
              Є протерміновані етапи
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
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

        <Stack spacing={1.2} mb={2}>
          <Typography>
            Замовлень: {stats.total} • Вчасно: {stats.onTime} ({stats.onTimeRate}%)
          </Typography>
          <Typography>
            Середній цикл (робочий): {formatDuration(stats.avgWork)} • Фактичний: {formatDuration(stats.avgCal)}
          </Typography>
          <Typography variant="subtitle2">Етапи, де були протермінування</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
            {Object.entries(stats.overByStage).map(([gid, cnt]) => (
              <Chip
                key={gid}
                color="error"
                variant="outlined"
                label={`${stageLabels[gid] || gid}: ${cnt}`}
              />
            ))}
            {Object.keys(stats.overByStage).length === 0 && (
              <Typography variant="body2" color="text.secondary">Протермінувань не було</Typography>
            )}
          </Stack>
        </Stack>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Список замовлень
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'id' ? sort.dir : false}>
                {sortLabel('id', 'ID')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'stage' ? sort.dir : false}>
                {sortLabel('stage', 'Етап')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'created' ? sort.dir : false}>
                {sortLabel('created', 'Створено')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'updated' ? sort.dir : false}>
                {sortLabel('updated', 'Оновлено')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'work' ? sort.dir : false}>
                {sortLabel('work', 'Робочий час')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'calendar' ? sort.dir : false}>
                {sortLabel('calendar', 'Фактичний')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'sla' ? sort.dir : false}>
                {sortLabel('sla', 'SLA')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((o, idx) => {
              const calTotal = o.stage_calendar_seconds
                ? Object.values(o.stage_calendar_seconds).reduce((s, v) => s + (v || 0), 0)
                : 0;
              const sla =
                o.sla_states && Object.values(o.sla_states).some((s) => s === 'over')
                  ? 'over'
                  : o.sla_states && Object.values(o.sla_states).some((s) => s === 'near')
                  ? 'near'
                  : 'ok';
              return (
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
                  <TableCell>{fmtDateTime(o.order_created_at)}</TableCell>
                  <TableCell>{fmtDateTime(o.last_changed_at)}</TableCell>
                  <TableCell>{formatDuration(o.cycle_seconds || 0)}</TableCell>
                  <TableCell>{formatDuration(calTotal)}</TableCell>
                  <TableCell>{sla}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>Немає даних за період / фільтром</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={sorted.length}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100, 250, 500]}
          labelRowsPerPage="Рядків на сторінці"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} з ${count}`}
        />
      </CardContent>
    </Card>
  );
};

export default SuccessReport;
