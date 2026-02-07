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
  Chip,
  Button
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { formatDuration, fmtDateTime } from '../utils/time';

const StageTimeReport = ({ orders = [], stageLabels = {}, onFetch = () => {}, onOpenOrder = () => {} }) => {
  const [range, setRange] = useState({
    from: dayjs().format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD')
  });
  const [urgentFilter, setUrgentFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'updated', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  useEffect(() => {
    onFetch(range.from, range.to);
  }, [range.from, range.to, onFetch]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (urgentFilter === 'urgent' && !o.is_urgent) return false;
      if (urgentFilter === 'normal' && o.is_urgent) return false;
      return true;
    });
  }, [orders, urgentFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const dir = sort.dir === 'asc' ? 1 : -1;
    const calendarTotal = (o) =>
      o.stage_calendar_seconds ? Object.values(o.stage_calendar_seconds).reduce((s, v) => s + (v || 0), 0) : 0;
    const getValue = (o) => {
      switch (sort.key) {
        case 'id':
          return o.order_id || 0;
        case 'urgent':
          return o.is_urgent ? 1 : 0;
        case 'created':
          return o.order_created_at ? new Date(o.order_created_at).getTime() : null;
        case 'updated':
          return o.last_changed_at ? new Date(o.last_changed_at).getTime() : null;
        case 'work':
          return o.cycle_seconds || 0;
        case 'calendar':
          return calendarTotal(o);
        case 'stages':
          return o.stage_seconds ? Object.keys(o.stage_seconds).length : 0;
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
  }, [filtered, sort]);

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
    const stageSumWork = {};
    const stageSumCal = {};
    const stageCount = {};
    let cycleSumWork = 0;
    let cycleCountWork = 0;
    let cycleSumCal = 0;
    let cycleCountCal = 0;

    filtered.forEach((o) => {
      if (o.stage_seconds) {
        Object.entries(o.stage_seconds).forEach(([gid, sec]) => {
          stageSumWork[gid] = (stageSumWork[gid] || 0) + (sec || 0);
          stageCount[gid] = (stageCount[gid] || 0) + 1;
        });
      }
      if (o.stage_calendar_seconds) {
        Object.entries(o.stage_calendar_seconds).forEach(([gid, sec]) => {
          stageSumCal[gid] = (stageSumCal[gid] || 0) + (sec || 0);
        });
      }
      if (o.cycle_seconds != null) {
        cycleSumWork += o.cycle_seconds || 0;
        cycleCountWork += 1;
      }
      if (o.stage_calendar_seconds) {
        const totalCal = Object.values(o.stage_calendar_seconds).reduce((s, v) => s + (v || 0), 0);
        cycleSumCal += totalCal;
        cycleCountCal += 1;
      }
    });

    const stageAvg = Object.keys({ ...stageSumWork, ...stageSumCal }).map((gid) => {
      const count = stageCount[gid] || filtered.length || 1;
      return {
        gid,
        name: stageLabels[gid] || `Етап ${gid}`,
        avgWork: (stageSumWork[gid] || 0) / count,
        avgCal: (stageSumCal[gid] || 0) / count
      };
    });

    const avgCycleWork = cycleCountWork ? cycleSumWork / cycleCountWork : 0;
    const avgCycleCal = cycleCountCal ? cycleSumCal / cycleCountCal : 0;

    return { stageAvg, avgCycleWork, avgCycleCal };
  }, [filtered, stageLabels]);

  const resetRange = () => {
    const today = dayjs().format('YYYY-MM-DD');
    setRange({ from: today, to: today });
  };

  return (
    <Card>
      <CardHeader title="Час по етапах" subheader="Робочий і фактичний час, середні значення та деталізація" />
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

        <Typography sx={{ mb: 1 }}>
          Середній повний цикл — робочий: {formatDuration(stats.avgCycleWork)} • фактичний: {formatDuration(stats.avgCycleCal)}
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Середній час по етапах
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1} mb={2}>
          {stats.stageAvg.map((r) => (
            <Chip
              key={r.gid}
              label={`${r.name}: робочий ${formatDuration(r.avgWork)} | фактичний ${formatDuration(r.avgCal)}`}
              variant="outlined"
            />
          ))}
          {stats.stageAvg.length === 0 && (
            <Typography variant="body2" color="text.secondary">Немає даних для обраних фільтрів</Typography>
          )}
        </Stack>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Замовлення (робочий / фактичний час по етапах)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'id' ? sort.dir : false}>
                {sortLabel('id', 'ID')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'urgent' ? sort.dir : false}>
                {sortLabel('urgent', 'Термінове')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'created' ? sort.dir : false}>
                {sortLabel('created', 'Створено')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'updated' ? sort.dir : false}>
                {sortLabel('updated', 'Оновлено')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'work' ? sort.dir : false}>
                {sortLabel('work', 'Цикл роб.')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'calendar' ? sort.dir : false}>
                {sortLabel('calendar', 'Цикл факт.')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'stages' ? sort.dir : false}>
                {sortLabel('stages', 'Етапи')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((o, idx) => {
              const calTotal = o.stage_calendar_seconds
                ? Object.values(o.stage_calendar_seconds).reduce((s, v) => s + (v || 0), 0)
                : 0;
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
                  <TableCell>{o.is_urgent ? 'Так' : 'Ні'}</TableCell>
                  <TableCell>{fmtDateTime(o.order_created_at)}</TableCell>
                  <TableCell>{fmtDateTime(o.last_changed_at)}</TableCell>
                  <TableCell>{formatDuration(o.cycle_seconds || 0)}</TableCell>
                  <TableCell>{formatDuration(calTotal)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5}>
                      {o.stage_seconds &&
                        Object.entries(o.stage_seconds).map(([gid, sec]) => (
                          <Chip
                            key={gid}
                            size="small"
                            label={`${stageLabels[gid] || gid}: ${formatDuration(sec)} / ${formatDuration(
                              o.stage_calendar_seconds?.[gid] || 0
                            )}`}
                            variant="outlined"
                          />
                        ))}
                      {!o.stage_seconds && <Chip size="small" label="—" />}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>Немає даних за фільтрами</TableCell>
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

export default StageTimeReport;
