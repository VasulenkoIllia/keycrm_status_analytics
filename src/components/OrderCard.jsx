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
import { STAGE_LIMITS_HOURS, STAGE_LABELS } from '../data/mockOrders';
import StageBar from './StageBar';

const statusColorMap = {
  ok: 'success',
  near: 'warning',
  over: 'error',
  neutral: 'info'
};

const STAGE_ORDER = ['new', 'approval', 'production', 'delivery', 'done'];

const OrderCard = ({ order, onOpenTimeline }) => {
  const currentStageKey =
    STAGE_ORDER.filter((k) => order.stageTimes?.[k]).at(-1) || STAGE_ORDER[0];
  const stageState = (() => {
    if (!currentStageKey) return 'neutral';
    const seconds = order.stageTimes[currentStageKey];
    return slaStatus(seconds, STAGE_LIMITS_HOURS[currentStageKey]);
  })();

  return (
    <Card sx={{ background: '#0f1219' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Typography variant="h6">#{order.id}</Typography>
            <Chip
              size="small"
              color={statusColorMap[stageState]}
              label={order.currentStatus}
              variant="outlined"
            />
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#9ba4b5' }}>
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

        <StageBar stageTimes={order.stageTimes} />

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
          {Object.entries(order.stageTimes).map(([stage, seconds]) => (
            <Chip
              key={stage}
              size="small"
              icon={<DoneAllIcon fontSize="small" />}
              label={`${STAGE_LABELS[stage] || stage}: ${formatDuration(seconds)}`}
              sx={{ bgcolor: '#111722' }}
            />
          ))}
        </Stack>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        <Button size="small" variant="outlined" onClick={() => onOpenTimeline(order)}>
          Деталі часу
        </Button>
      </CardActions>
    </Card>
  );
};

export default OrderCard;
