import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  Chip,
  Button,
  Stack
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { slaStatus, formatDuration } from '../utils/time';
import StageBar from './StageBar';

const statusColorMap = {
  ok: 'success',
  near: 'warning',
  over: 'error',
  neutral: 'info'
};

const OrderCard = ({ order, onOpenTimeline, onToggleUrgent, stageLabels = {}, stageLimits = {}, nearThreshold = 0.8 }) => {
  // Періодичний "тік", щоб фактичний час оновлювався без перезавантаження.
  const [nowTs, setNowTs] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 30000); // раз на 30 секунд
    return () => clearInterval(id);
  }, []);

  const latestGroupId = Object.keys(order.stageTimes || {}).map(Number).sort((a, b) => b - a)[0];
  const stageState = (() => {
    if (!latestGroupId) return 'neutral';
    const seconds = order.stageTimes[latestGroupId] || 0;
    return slaStatus(seconds, stageLimits[latestGroupId], nearThreshold);
  })();

  // totals
  const workingTotal = Object.values(order.stageTimes || {}).reduce((s, v) => s + (v || 0), 0);
  const created = order.createdAt ? new Date(order.createdAt) : null;
  const calendarTotal = created ? Math.max(0, (nowTs - created.getTime()) / 1000) : null;

  return (
    <Card sx={{ background: '#0f1219' }}>
      <CardContent>
        <Box display="flex" alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" flexDirection={{ xs: 'column', sm: 'row' }} gap={1} mb={1}>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <Typography variant="h6">#{order.id}</Typography>
          <Chip size="small" color={statusColorMap[stageState]} label={order.currentStatus} variant="outlined" />
          {order.isUrgent && <Chip size="small" color="error" label="Термінове" />}
          {order.urgentRule && (
            <Chip size="small" variant="outlined" color="error" label={`Rule: ${order.urgentRule}`} />
          )}
        </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#9ba4b5' }} flexWrap="wrap" rowGap={0.5}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <AccessTimeIcon fontSize="small" />
              <Typography variant="body2">
                створено {new Date(order.createdAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <LocalShippingIcon fontSize="small" />
              <Typography variant="body2">
                оновлено {new Date(order.updatedAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <StageBar stageTimes={order.stageTimes} stageLabels={stageLabels} stageLimits={stageLimits} nearThreshold={nearThreshold} />

        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            color="info"
            variant="outlined"
            label={`Робочий час: ${formatDuration(workingTotal)}`}
            sx={{ bgcolor: '#0f1219', borderColor: '#1f2a3a', color: '#e6eaf2' }}
          />
          {calendarTotal !== null && (
            <Chip
              size="small"
              color="default"
              variant="outlined"
              label={`Фактичний час: ${formatDuration(calendarTotal)}`}
              sx={{ bgcolor: '#0f1219', borderColor: '#1f2a3a', color: '#e6eaf2' }}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
          {Object.entries(order.stageTimes).map(([stage, seconds]) => (
            <Chip
              key={stage}
              size="small"
              icon={<DoneAllIcon fontSize="small" />}
              label={`${stageLabels[Number(stage)] || stage}: ${formatDuration(seconds)}`}
              sx={{ bgcolor: '#111722' }}
            />
          ))}
        </Stack>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        {onToggleUrgent && (
          <Button size="small" variant="text" onClick={() => onToggleUrgent(order)}>
            {order.isUrgent ? 'Вимкнути термінове' : 'Зробити терміновим'}
          </Button>
        )}
        <Button size="small" variant="outlined" onClick={() => onOpenTimeline(order)}>
          Деталі часу
        </Button>
      </CardActions>
    </Card>
  );
};

export default OrderCard;
