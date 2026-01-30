import React from 'react';
import { Box, TextField, InputAdornment, IconButton, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

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
      <TextField
        type="date"
        label="Від"
        size="small"
        InputLabelProps={{ shrink: true }}
        value={filters.from}
        onChange={handleChange('from')}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <CalendarTodayIcon fontSize="small" />
            </InputAdornment>
          )
        }}
      />
      <TextField
        type="date"
        label="До"
        size="small"
        InputLabelProps={{ shrink: true }}
        value={filters.to}
        onChange={handleChange('to')}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <CalendarTodayIcon fontSize="small" />
            </InputAdornment>
          )
        }}
      />
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
      <Button variant="outlined" color="primary" onClick={() => onChange({ from: '', to: '', query: '' })}>Скинути</Button>
      <Button variant="contained" color="primary" onClick={onSubmit}>Застосувати</Button>
    </Box>
  );
};

export default FilterBar;
