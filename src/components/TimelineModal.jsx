import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Chip,
  Stack
} from '@mui/material';
import { STAGE_LABELS } from '../data/mockOrders';
import { fmtDateTime, formatDuration } from '../utils/time';

const stageColor = {
  new: 'success',
  approval: 'info',
  production: 'warning',
  delivery: 'primary',
  done: 'success'
};

const TimelineModal = ({ open, onClose, order }) => {
  if (!order) return null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { backgroundColor: '#0f1219', border: '1px solid #202632' } }}
    >
      <DialogTitle>
        Таймлайн — замовлення #{order.id}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {order.timeline.map((item, idx) => (
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
                  color={stageColor[item.stage] || 'default'}
                  label={STAGE_LABELS[item.stage]}
                  variant="outlined"
                />
                <Typography variant="subtitle2">{item.status}</Typography>
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
      </DialogContent>
    </Dialog>
  );
};

export default TimelineModal;
