import React from 'react';
import { Box, TextField, InputAdornment, IconButton, Button, Stack, Chip } from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import SearchIcon from '@mui/icons-material/Search';
import dayjs from 'dayjs';

const FilterBar = ({ filters, onChange, onSubmit }) => {
  const handleChange = (key) => (event) => {
    onChange({ ...filters, [key]: event.target.value });
  };

  return (
    <Box
      display="flex"
      gap={2}
      alignItems="center"
      sx={{ mb: 3, flexWrap: 'wrap' }}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          label="Від"
          value={filters.from ? dayjs(filters.from) : null}
          onChange={(val) => {
            onChange({ ...filters, from: val ? val.format('YYYY-MM-DD') : '' });
          }}
          format="DD.MM.YYYY"
          slotProps={{
            textField: {
              size: 'small',
              sx: { minWidth: 150 }
            },
            actionBar: { actions: ['today', 'clear'] }
          }}
        />
        <DatePicker
          label="До"
          value={filters.to ? dayjs(filters.to) : null}
          onChange={(val) => {
            onChange({ ...filters, to: val ? val.format('YYYY-MM-DD') : '' });
          }}
          format="DD.MM.YYYY"
          slotProps={{
            textField: {
              size: 'small',
              sx: { minWidth: 150 }
            },
            actionBar: { actions: ['today', 'clear'] }
          }}
        />
      </LocalizationProvider>
      <TextField
        size="small"
        label="Пошук за номером"
        value={filters.query}
        onChange={handleChange('query')}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small">
                <SearchIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          )
        }}
        sx={{ minWidth: 220 }}
      />
      <Box flex={1} />
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          clickable
          variant={filters.onlyUrgent ? 'filled' : 'outlined'}
          color="error"
          label="Термінові"
          onClick={() => onChange({ ...filters, onlyUrgent: !filters.onlyUrgent })}
        />
        <Chip
          clickable
          variant={filters.onlyOver ? 'filled' : 'outlined'}
          color="warning"
          label="Протерміновані"
          onClick={() => onChange({ ...filters, onlyOver: !filters.onlyOver })}
        />
      </Stack>
      <Button variant="outlined" color="primary" onClick={() => onChange({ from: '', to: '', query: '' })}>Скинути</Button>
      <Button variant="contained" color="primary" onClick={onSubmit}>Застосувати</Button>
    </Box>
  );
};

export default FilterBar;
