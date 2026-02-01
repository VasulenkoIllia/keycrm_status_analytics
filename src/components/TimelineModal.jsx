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
import { fmtDateTime, formatDuration } from '../utils/time';

const colorByGroup = {
  1: 'success',
  2: 'info',
  3: 'warning',
  4: 'primary'
};

const TimelineModal = ({ open, onClose, order }) => {
  if (!order) return null;
  const items = order.timeline || [];
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
      </DialogContent>
    </Dialog>
  );
};

export default TimelineModal;
