import dayjs from 'dayjs';

export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} год ${minutes.toString().padStart(2, '0')} хв`;
};

export const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD.MM HH:mm') : '—');

export const slaStatus = (seconds, limitHours) => {
  if (!limitHours) return 'neutral';
  const limit = limitHours * 3600;
  const warn = limit * 0.8;
  if (seconds > limit) return 'over';
  if (seconds >= warn) return 'near';
  return 'ok';
};
