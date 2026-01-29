import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { formatDuration, slaStatus } from '../utils/time';

const STATUS_COLORS = {
  ok: '#41d69f',
  near: '#f7b500',
  over: '#f74c52',
  neutral: '#7c8df2'
};

const StageBar = ({ stageTimes = {}, stageLabels = {}, stageLimits = {} }) => {
  const items = Object.entries(stageTimes);
  return (
    <Box display="flex" gap={1.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
      {items.map(([key, seconds]) => {
        const label = stageLabels[Number(key)] || key;
        const limit = stageLimits[Number(key)];
        const state = slaStatus(seconds, limit);
        const ratio = Math.min(1, limit ? seconds / (limit * 3600) : 0);
        return (
          <Tooltip
            key={key}
            title={`Ліміт: ${limit} год · Факт: ${formatDuration(seconds)}`}
            arrow
            placement="top"
          >
            <Box
              sx={{
                minWidth: 140,
                flex: '1 1 140px',
                background: '#11151d',
                border: '1px solid #202632',
                borderRadius: 10,
                p: 1.2
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="subtitle2">{label}</Typography>
                <Chip
                  size="small"
                  label={`${limit} год`}
                  sx={{ bgcolor: '#1b2130', color: '#9ba4b5' }}
                />
              </Box>
              <Box
                sx={{
                  position: 'relative',
                  height: 10,
                  borderRadius: 999,
                  background: '#1c2633',
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: `${ratio * 100}%`,
                    background: STATUS_COLORS[state],
                    transition: 'width 0.4s ease',
                    boxShadow: '0 0 8px rgba(0,0,0,0.25)'
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: '#9ba4b5', mt: 0.75, display: 'block' }}>
                {formatDuration(seconds)}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default StageBar;
