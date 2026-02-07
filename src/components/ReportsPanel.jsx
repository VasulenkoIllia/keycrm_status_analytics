import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
  TablePagination,
  FormControlLabel,
  Checkbox,
  Button
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { formatDuration, fmtDateTime } from '../utils/time';

const durationSeconds = (o) => {
  if (o.cycle_seconds != null) return o.cycle_seconds;
  if (o.stage_seconds) return Object.values(o.stage_seconds).reduce((s, v) => s + (v || 0), 0);
  return 0;
};

const calendarDurationSeconds = (o) => {
  if (o.start_at && o.end_at) {
    const start = new Date(o.start_at).getTime();
    const end = new Date(o.end_at).getTime();
    if (Number.isFinite(start) && Number.isFinite(end)) return Math.max(0, (end - start) / 1000);
  }
  if (o.stage_calendar_seconds) return Object.values(o.stage_calendar_seconds).reduce((s, v) => s + (v || 0), 0);
  return 0;
};

const slaState = (o) => {
  if (!o.sla_states) return 'neutral';
  const vals = Object.values(o.sla_states);
  if (vals.includes('over')) return 'over';
  if (vals.includes('near')) return 'near';
  if (vals.includes('ok')) return 'ok';
  return 'neutral';
};

const ReportsPanel = ({ orders = [], stageLabels = {}, statuses = [], onFetch = () => {}, loading = false, onOpenOrder = () => {} }) => {
  // Кастомні фільтри для звіту
  const [custom, setCustom] = useState({
    stageGroups: [],
    statusIds: [],
    onlyUrgent: '',
    slaState: '',
    from: '',
    to: '',
    onlyOverOrders: false,
    onlyOverStages: false
  });
  const [sort, setSort] = useState({ key: 'updated', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // підвантаження даних за діапазоном дат (дата створення)
  useEffect(() => {
    onFetch(custom.from, custom.to);
  }, [custom.from, custom.to, onFetch]);

  const statusMap = useMemo(
    () => Object.fromEntries(statuses.map((s) => [String(s.id), s.name])),
    [statuses]
  );

  const filtered = useMemo(() => {
    const fromTs = custom.from ? dayjs(custom.from).startOf('day').valueOf() : null;
    const toTs = custom.to ? dayjs(custom.to).endOf('day').valueOf() : null;
    return orders.filter((o) => {
      if (custom.onlyUrgent === 'urgent' && !o.is_urgent) return false;
      if (custom.onlyUrgent === 'normal' && o.is_urgent) return false;
      if (custom.stageGroups.length && !custom.stageGroups.includes(String(o.last_status_group_id))) return false;
      if (custom.statusIds.length && !custom.statusIds.includes(String(o.last_status_id))) return false;
      const st = slaState(o);
      if (custom.slaState && st !== custom.slaState) return false;
      if (custom.onlyOverOrders && st !== 'over') return false;
      if (custom.onlyOverStages && !(o.sla_states && Object.values(o.sla_states).some((s) => s === 'over'))) return false;
      const ts = o.order_created_at ? new Date(o.order_created_at).getTime() : null;
      if (fromTs && ts && ts < fromTs) return false;
      if (toTs && ts && ts > toTs) return false;
      return true;
    });
  }, [orders, custom]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const dir = sort.dir === 'asc' ? 1 : -1;
    const slaScore = (state) => (state === 'over' ? 3 : state === 'near' ? 2 : state === 'ok' ? 1 : 0);
    const getValue = (o) => {
      switch (sort.key) {
        case 'id':
          return o.order_id || 0;
        case 'stage':
          return stageLabels[o.last_status_group_id] || String(o.last_status_group_id || '');
        case 'status':
          return statusMap[String(o.last_status_id)] || String(o.last_status_id || '');
        case 'urgent':
          return o.is_urgent ? 1 : 0;
        case 'created':
          return o.order_created_at ? new Date(o.order_created_at).getTime() : null;
        case 'updated':
          return o.last_changed_at ? new Date(o.last_changed_at).getTime() : null;
        case 'work':
          return durationSeconds(o);
        case 'calendar':
          return calendarDurationSeconds(o);
        case 'sla':
          return slaScore(slaState(o));
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
  }, [filtered, sort, stageLabels, statusMap]);

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

  const handleReset = () => {
    setCustom({
      stageGroups: [],
      statusIds: [],
      onlyUrgent: '',
      slaState: '',
      from: '',
      to: '',
      onlyOverOrders: false,
      onlyOverStages: false
    });
  };

  return (
    <Card>
      <CardHeader title="Кастомний звіт" subheader="Фільтрується за датою створення замовлення" />
      <CardContent>
        <Stack direction="row" spacing={2} flexWrap="wrap" rowGap={2} mb={2}>
          <TextField
            select
            size="small"
            label="Етапи"
            value={custom.stageGroups}
            onChange={(e) => setCustom((p) => ({ ...p, stageGroups: e.target.value, statusIds: [] }))}
            sx={{ minWidth: 200 }}
            SelectProps={{ multiple: true }}
          >
            {Object.entries(stageLabels).map(([gid, name]) => (
              <MenuItem key={gid} value={gid}>{name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Статуси"
            value={custom.statusIds}
            onChange={(e) => setCustom((p) => ({ ...p, statusIds: e.target.value }))}
            sx={{ minWidth: 240 }}
            SelectProps={{ multiple: true }}
          >
            {statuses
              .filter((s) => !custom.stageGroups.length || custom.stageGroups.includes(String(s.group_id)))
              .map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
              ))}
          </TextField>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant={custom.onlyUrgent === '' ? 'contained' : 'outlined'}
              onClick={() => setCustom((p) => ({ ...p, onlyUrgent: '' }))}
            >
              Усі
            </Button>
            <Button
              size="small"
              variant={custom.onlyUrgent === 'urgent' ? 'contained' : 'outlined'}
              onClick={() => setCustom((p) => ({ ...p, onlyUrgent: 'urgent' }))}
            >
              Термінові
            </Button>
            <Button
              size="small"
              variant={custom.onlyUrgent === 'normal' ? 'contained' : 'outlined'}
              onClick={() => setCustom((p) => ({ ...p, onlyUrgent: 'normal' }))}
            >
              Звичайні
            </Button>
          </Stack>

          <TextField
            select
            size="small"
            label="SLA"
            value={custom.slaState}
            onChange={(e) => setCustom((p) => ({ ...p, slaState: e.target.value }))}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">Усі</MenuItem>
            <MenuItem value="ok">OK</MenuItem>
            <MenuItem value="near">Near</MenuItem>
            <MenuItem value="over">Over</MenuItem>
          </TextField>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Stack direction="row" spacing={2} flexWrap="wrap" rowGap={1}>
              <DatePicker
                label="Від"
                value={custom.from ? dayjs(custom.from) : null}
                onChange={(val) => setCustom((p) => ({ ...p, from: val ? val.format('YYYY-MM-DD') : '' }))}
                format="DD.MM.YYYY"
                slotProps={{
                  textField: { size: 'small', sx: { minWidth: 150 } },
                  actionBar: { actions: ['clear', 'today'] }
                }}
              />
              <DatePicker
                label="До"
                value={custom.to ? dayjs(custom.to) : null}
                onChange={(val) => setCustom((p) => ({ ...p, to: val ? val.format('YYYY-MM-DD') : '' }))}
                format="DD.MM.YYYY"
                slotProps={{
                  textField: { size: 'small', sx: { minWidth: 150 } },
                  actionBar: { actions: ['clear', 'today'] }
                }}
              />
            </Stack>
          </LocalizationProvider>

          <FormControlLabel
            control={
              <Checkbox
                checked={custom.onlyOverOrders}
                onChange={(e) => setCustom((p) => ({ ...p, onlyOverOrders: e.target.checked }))}
              />
            }
            label="Лише протерміновані замовлення"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={custom.onlyOverStages}
                onChange={(e) => setCustom((p) => ({ ...p, onlyOverStages: e.target.checked }))}
              />
            }
            label="Замовлення з протермінованими етапами"
          />
          <Button variant="outlined" size="small" onClick={handleReset}>
            Скинути фільтри
          </Button>
        </Stack>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Результат: {loading ? 'Завантаження…' : `${filtered.length} замовлень`}
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
              <TableCell sx={headCellSx} sortDirection={sort.key === 'status' ? sort.dir : false}>
                {sortLabel('status', 'Статус')}
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
                {sortLabel('work', 'Цикл (роб.)')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'calendar' ? sort.dir : false}>
                {sortLabel('calendar', 'Цикл повного часу')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'sla' ? sort.dir : false}>
                {sortLabel('sla', 'SLA')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((o, idx) => (
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
                <TableCell>{statusMap[String(o.last_status_id)] || o.last_status_id}</TableCell>
                <TableCell>{o.is_urgent ? 'Так' : 'Ні'}</TableCell>
                <TableCell>{fmtDateTime(o.order_created_at)}</TableCell>
                <TableCell>{fmtDateTime(o.last_changed_at)}</TableCell>
                <TableCell>{formatDuration(durationSeconds(o))}</TableCell>
                <TableCell>{formatDuration(calendarDurationSeconds(o))}</TableCell>
                <TableCell>{slaState(o)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9}>Немає даних за вибраними умовами</TableCell>
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

export default ReportsPanel;
