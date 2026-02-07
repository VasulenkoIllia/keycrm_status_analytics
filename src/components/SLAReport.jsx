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
import { fmtDateTime } from '../utils/time';

const SLAReport = ({ orders = [], stageLabels = {}, statuses = [], onFetch = () => {}, onOpenOrder = () => {} }) => {
  const [range, setRange] = useState({
    from: dayjs().format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD')
  });
  const [urgentFilter, setUrgentFilter] = useState('all'); // all | urgent | normal
  const [sort, setSort] = useState({ key: 'updated', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

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

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const dir = sort.dir === 'asc' ? 1 : -1;
    const slaScore = (o) => {
      if (!o.sla_states) return 0;
      let score = 0;
      Object.values(o.sla_states).forEach((st) => {
        if (st === 'over') score = Math.max(score, 3);
        else if (st === 'near') score = Math.max(score, 2);
        else if (st === 'ok') score = Math.max(score, 1);
      });
      return score;
    };
    const getValue = (o) => {
      switch (sort.key) {
        case 'id':
          return o.order_id || 0;
        case 'urgent':
          return o.is_urgent ? 1 : 0;
        case 'status':
          return statusesMap[o.last_status_id] || String(o.last_status_id || '');
        case 'created':
          return o.order_created_at ? new Date(o.order_created_at).getTime() : null;
        case 'updated':
          return o.last_changed_at ? new Date(o.last_changed_at).getTime() : null;
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
  }, [filtered, sort, statusesMap]);

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
              <TableCell sx={headCellSx} sortDirection={sort.key === 'id' ? sort.dir : false}>
                {sortLabel('id', 'ID')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'urgent' ? sort.dir : false}>
                {sortLabel('urgent', 'Термінове')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'status' ? sort.dir : false}>
                {sortLabel('status', 'Поточний статус')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'created' ? sort.dir : false}>
                {sortLabel('created', 'Створено')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'updated' ? sort.dir : false}>
                {sortLabel('updated', 'Оновлено')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'sla' ? sort.dir : false}>
                {sortLabel('sla', 'Етапи (SLA)')}
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
                <TableCell colSpan={6}>Немає даних за фільтрами</TableCell>
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

export default SLAReport;
