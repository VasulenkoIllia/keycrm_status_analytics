import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Chip,
  Stack,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import { fmtDateTime, formatDuration } from '../utils/time';

const colorByGroup = {
  1: 'success',
  2: 'info',
  3: 'warning',
  4: 'primary'
};

const TimelineModal = ({ open, onClose, order, stageLabels = {} }) => {
  if (!order) return null;
  const [tab, setTab] = useState(0);
  const items = order.timeline || [];
  const stageSeconds = order.stage_seconds || {};
  const stageCalendar = order.stage_calendar_seconds || {};
  const slaStates = order.sla_states || {};

  const totalWork = useMemo(
    () => Object.values(stageSeconds).reduce((s, v) => s + (v || 0), 0),
    [stageSeconds]
  );
  const totalCal = useMemo(
    () => Object.values(stageCalendar).reduce((s, v) => s + (v || 0), 0),
    [stageCalendar]
  );

  const stageRows = useMemo(
    () =>
      Object.keys({ ...stageSeconds, ...stageCalendar }).map((gid) => ({
        gid,
        name: stageLabels[gid] || `Етап ${gid}`,
        work: stageSeconds[gid] || 0,
        cal: stageCalendar[gid] || 0,
        sla: slaStates[gid] || 'neutral'
      })),
    [stageSeconds, stageCalendar, slaStates, stageLabels]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { backgroundColor: '#0f1219', border: '1px solid #202632' } }}
    >
      <DialogTitle>
        Таймлайн — замовлення #{order.id || order.order_id}
      </DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Загальне" />
          <Tab label="Час по етапах" />
          <Tab label="Таймлайн" />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
              {order.is_urgent && <Chip color="error" size="small" label="Термінове" />}
              {order.urgent_rule && (
                <Chip size="small" variant="outlined" label={`Rule: ${order.urgent_rule}`} />
              )}
              <Chip size="small" label={`Етап: ${stageLabels[order.last_status_group_id] || order.last_status_group_id}`} />
              <Chip size="small" variant="outlined" label={`Статус: ${order.currentStatus || order.last_status_id}`} />
            </Stack>
            <Typography variant="body2">Створено: {fmtDateTime(order.order_created_at || order.createdAt)}</Typography>
            <Typography variant="body2">Оновлено: {fmtDateTime(order.last_changed_at || order.updatedAt)}</Typography>
            <Divider />
            <Typography variant="subtitle2">Час у циклі</Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" rowGap={1}>
              <Chip label={`Робочий: ${formatDuration(totalWork)}`} />
              <Chip label={`Фактичний: ${formatDuration(totalCal)}`} />
            </Stack>
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={1}>
            {stageRows.map((r) => (
              <Box
                key={r.gid}
                sx={{ p: 1, border: '1px solid #1f2634', borderRadius: 10, background: '#0c0f15' }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                  <Chip size="small" color={colorByGroup[r.gid] || 'default'} label={r.name} />
                  <Chip size="small" variant="outlined" label={`SLA: ${r.sla}`} />
                </Stack>
                <Typography variant="body2">Робочий: {formatDuration(r.work)}</Typography>
                <Typography variant="body2">Фактичний: {formatDuration(r.cal)}</Typography>
              </Box>
            ))}
            {stageRows.length === 0 && (
              <Typography variant="body2" color="text.secondary">Немає даних по етапах</Typography>
            )}
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {items.length === 0 && (
              <Typography variant="body2" color="text.secondary">Подій не знайдено</Typography>
            )}
            {items.map((item, idx) => (
              <Box
                key={idx}
                sx={{
                  p: 1.5,
                  border: '1px solid #1f2634',
                  borderRadius: 10,
                  background: '#0c0f15'
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                  <Chip
                    size="small"
                    color={colorByGroup[item.group_id] || 'default'}
                    label={item.stage || `Група ${item.group_id || ''}`}
                    variant="outlined"
                  />
                  <Typography variant="subtitle2">{item.status || 'Статус'}</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#9ba4b5' }}>
                  вхід: {fmtDateTime(item.enteredAt)} &nbsp;•&nbsp; вихід: {fmtDateTime(item.leftAt)}
                </Typography>
                {item.leftAt && (
                  <Typography variant="body2" sx={{ color: '#e8edf5', fontWeight: 600, mt: 0.5 }}>
                    {formatDuration(
                      (new Date(item.leftAt) - new Date(item.enteredAt)) / 1000
                    )}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TimelineModal;
