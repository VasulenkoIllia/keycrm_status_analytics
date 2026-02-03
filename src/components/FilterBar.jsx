import React from 'react';
import { Box, TextField, InputAdornment, IconButton, Button, Stack, Chip, MenuItem } from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import SearchIcon from '@mui/icons-material/Search';
import dayjs from 'dayjs';

const FilterBar = ({ filters, onChange, onSubmit, stageOptions = [], statusOptions = [] }) => {
  const handleChange = (key) => (event) => {
    onChange({ ...filters, [key]: event.target.value });
  };

  const slaButtons = [
    { key: 'ok', label: 'SLA OK', color: 'success' },
    { key: 'near', label: 'SLA Near', color: 'warning' },
    { key: 'over', label: 'SLA Over', color: 'error' }
  ];

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
          value={filters.from ? dayjs(filters.from) : dayjs()}
          onChange={(val) => {
            onChange({ ...filters, from: val ? val.format('YYYY-MM-DD') : '' });
          }}
          format="DD.MM.YYYY"
          slotProps={{
            textField: {
              size: 'small',
              sx: { minWidth: 150 }
            },
            actionBar: { actions: ['clear', 'today'] }
          }}
        />
        <DatePicker
          label="До"
          value={filters.to ? dayjs(filters.to) : dayjs()}
          onChange={(val) => {
            onChange({ ...filters, to: val ? val.format('YYYY-MM-DD') : '' });
          }}
          format="DD.MM.YYYY"
          slotProps={{
            textField: {
              size: 'small',
              sx: { minWidth: 150 }
            },
            actionBar: { actions: ['clear', 'today'] }
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
      <TextField
        select
        size="small"
        label="Етап"
        value={filters.stageGroup}
        onChange={handleChange('stageGroup')}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">Усі етапи</MenuItem>
        {stageOptions.map((s) => (
          <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Статус"
        value={filters.statusId}
        onChange={handleChange('statusId')}
        sx={{ minWidth: 200 }}
      >
        <MenuItem value="">Усі статуси</MenuItem>
        {statusOptions
          .filter((s) => !filters.stageGroup || String(s.group_id) === String(filters.stageGroup))
          .map((s) => (
            <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
          ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Сортування"
        value={filters.sort}
        onChange={handleChange('sort')}
        sx={{ minWidth: 220 }}
      >
        <MenuItem value="duration_desc">Тривалість: довгі → короткі</MenuItem>
        <MenuItem value="duration_asc">Тривалість: короткі → довгі</MenuItem>
        <MenuItem value="date_desc">Дата створення: новіші → старші</MenuItem>
        <MenuItem value="date_asc">Дата створення: старші → новіші</MenuItem>
      </TextField>
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
        {slaButtons.map((btn) => (
          <Chip
            key={btn.key}
            clickable
            variant={filters.slaState === btn.key ? 'filled' : 'outlined'}
            color={btn.color}
            label={btn.label}
            onClick={() =>
              onChange({ ...filters, slaState: filters.slaState === btn.key ? '' : btn.key })
            }
          />
        ))}
      </Stack>
      <Button
        variant="outlined"
        color="primary"
        onClick={() =>
          onChange({
            from: '',
            to: '',
            query: '',
            onlyUrgent: false,
            onlyOver: false,
            slaState: '',
            stageGroup: '',
            statusId: '',
            sort: 'duration_desc'
          })
        }
      >
        Скинути
      </Button>
      <Button variant="contained" color="primary" onClick={onSubmit}>Застосувати</Button>
    </Box>
  );
};

export default FilterBar;
