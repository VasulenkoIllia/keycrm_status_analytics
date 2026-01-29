import React, { useMemo, useState } from 'react';
import { Box, Container, Grid, Typography, Stack, Chip } from '@mui/material';
import FilterBar from './components/FilterBar';
import OrderCard from './components/OrderCard';
import TimelineModal from './components/TimelineModal';
import { mockOrders, STAGE_LABELS } from './data/mockOrders';

const App = () => {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    query: ''
  });
  const [selected, setSelected] = useState(null);

  const filteredOrders = useMemo(() => {
    const q = filters.query.trim();
    return mockOrders.filter((o) => (q ? o.id.includes(q) : true));
  }, [filters]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Трекер часу по замовленнях</Typography>
          <Typography variant="body2" color="text.secondary">
            Ланцюжок: {Object.values(STAGE_LABELS).slice(0, 5).join(' → ')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip label="SLA: Новий до 12 год" color="success" variant="outlined" />
          <Chip label="Погодження/Виробництво до 24 год" color="warning" variant="outlined" />
          <Chip label="Доставка до 12 год" color="info" variant="outlined" />
        </Stack>
      </Box>

      <FilterBar filters={filters} onChange={setFilters} />

      <Grid container spacing={2}>
        {filteredOrders.map((order) => (
          <Grid item xs={12} md={6} key={order.id}>
            <OrderCard order={order} onOpenTimeline={setSelected} />
          </Grid>
        ))}
      </Grid>

      <TimelineModal open={!!selected} order={selected} onClose={() => setSelected(null)} />
    </Container>
  );
};

export default App;
