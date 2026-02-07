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

const CancellationReport = ({ orders = [], stageLabels = {}, statuses = [], onFetch = () => {}, onOpenOrder = () => {} }) => {
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

  const data = useMemo(() => {
    const statusMap = Object.fromEntries(statuses.map((s) => [String(s.id), s.name]));
    const filteredUrgent = orders.filter((o) => {
      if (urgentFilter === 'urgent') return o.is_urgent;
      if (urgentFilter === 'normal') return !o.is_urgent;
      return true;
    });
    const total = filteredUrgent.length;
    const canceled = filteredUrgent.filter((o) =>
      isCancelStage(stageLabels[o.last_status_group_id], o.last_status_group_id)
    );
    const rate = total ? Math.round((canceled.length / total) * 1000) / 10 : 0;

    // Розбиття по етапу відміни (звичайно це одна група)
    const byStage = {};
    const previousStageStats = {};
    const previousStatusStats = {};
    canceled.forEach((o) => {
      const key = o.last_status_group_id;
      byStage[key] = (byStage[key] || 0) + 1;

      let prevGid = o.prev_group_id;
      let prevStatus = o.prev_status_id;
      if (prevGid == null) {
        const tl = (o.timeline || []).slice().sort(
          (a, b) => new Date(a.enteredAt) - new Date(b.enteredAt)
        );
        if (tl.length >= 2) {
          const prev = tl[tl.length - 2];
          prevGid = prev.group_id;
          prevStatus = prev.status_id;
        }
      }
      if (prevGid != null) {
        previousStageStats[prevGid] = (previousStageStats[prevGid] || 0) + 1;
      }
      if (prevStatus != null) {
        previousStatusStats[prevStatus] = (previousStatusStats[prevStatus] || 0) + 1;
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
    const prevStatusRows = Object.entries(previousStatusStats).map(([sid, cnt]) => ({
      sid,
      name: statusMap[sid] || `Статус ${sid}`,
      count: cnt,
      rate: total ? Math.round((cnt / total) * 1000) / 10 : 0
    }));

    return { total, canceled, rate, stageRows, prevStageRows, prevStatusRows, statusMap };
  }, [orders, stageLabels, statuses, urgentFilter]);

  const prevStageStatus = (o) => {
    if (o.prev_group_id) {
      const name = stageLabels[o.prev_group_id] || o.prev_group_id;
      const sName = data.statusMap[String(o.prev_status_id)] || o.prev_status_id || '';
      return `${name} / ${sName}`;
    }
    const tl = (o.timeline || []).slice().sort(
      (a, b) => new Date(a.enteredAt) - new Date(b.enteredAt)
    );
    if (tl.length >= 2) {
      const prev = tl[tl.length - 2];
      const name = stageLabels[prev.group_id] || prev.stage || prev.group_id;
      const sName = data.statusMap[String(prev.status_id)] || prev.status || prev.status_id || '';
      return `${name} / ${sName}`;
    }
    return '—';
  };

  const sortedCanceled = useMemo(() => {
    const rows = [...data.canceled];
    const dir = sort.dir === 'asc' ? 1 : -1;
    const getValue = (o) => {
      switch (sort.key) {
        case 'id':
          return o.order_id || 0;
        case 'stage':
          return stageLabels[o.last_status_group_id] || String(o.last_status_group_id || '');
        case 'prev':
          return prevStageStatus(o);
        case 'created':
          return o.order_created_at ? new Date(o.order_created_at).getTime() : null;
        case 'updated':
          return o.last_changed_at ? new Date(o.last_changed_at).getTime() : null;
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
  }, [data.canceled, sort, stageLabels, data.statusMap]);

  useEffect(() => {
    if (page > 0 && page * rowsPerPage >= sortedCanceled.length) setPage(0);
  }, [sortedCanceled.length, page, rowsPerPage]);

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
  const paged = sortedCanceled.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

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

        <Typography variant="subtitle2" sx={{ mb: 1 }}>Попередній статус перед відміною</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1} mb={2}>
          {data.prevStatusRows.map((r) => (
            <Button key={r.sid} variant="outlined" size="small">
              {r.name}: {r.count} ({r.rate}%)
            </Button>
          ))}
          {data.prevStatusRows.length === 0 && (
            <Typography variant="body2" color="text.secondary">Немає даних про попередній статус</Typography>
          )}
        </Stack>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Список відмінених замовлень
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'id' ? sort.dir : false}>
                {sortLabel('id', 'ID')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'stage' ? sort.dir : false}>
                {sortLabel('stage', 'Етап відміни')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'prev' ? sort.dir : false}>
                {sortLabel('prev', 'Попередній етап / статус')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'created' ? sort.dir : false}>
                {sortLabel('created', 'Створено')}
              </TableCell>
              <TableCell sx={headCellSx} sortDirection={sort.key === 'updated' ? sort.dir : false}>
                {sortLabel('updated', 'Оновлено')}
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
                <TableCell>{prevStageStatus(o)}</TableCell>
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
        <TablePagination
          component="div"
          count={sortedCanceled.length}
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

export default CancellationReport;
