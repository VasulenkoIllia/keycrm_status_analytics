import dayjs from 'dayjs';

export const formatDuration = (seconds) => {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours} год ${minutes.toString().padStart(2, '0')} хв`;
};

export const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD.MM HH:mm') : '—');

export const slaStatus = (seconds, limitHours, nearThreshold = 0.8) => {
  if (!limitHours) return 'neutral';
  const limit = limitHours * 3600;
  const warn = limit * nearThreshold;
  if (seconds > limit) return 'over';
  if (seconds >= warn) return 'near';
  return 'ok';
};
