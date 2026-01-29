import React, { useEffect, useMemo, useState } from 'react';
import { Box, Container, Grid, Typography, Stack, Chip, Button, TextField } from '@mui/material';
import FilterBar from './components/FilterBar';
import OrderCard from './components/OrderCard';
import TimelineModal from './components/TimelineModal';
import AnalyticsPanel from './components/AnalyticsPanel';
import { fetchOrders, fetchTimeline, fetchDicts, openOrdersStream, setApiToken, login } from './api/client';
import { STAGE_LABELS as MOCK_STAGE_LABELS } from './data/mockOrders';

const PROJECTS = [
  { id: 1, name: 'custom-gifts' },
  { id: 2, name: 'gal-industries' }
];

const App = () => {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    query: ''
  });
  const [projectId, setProjectId] = useState(null);
  const [apiToken, setToken] = useState(() => localStorage.getItem('apiToken') || '');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [dicts, setDicts] = useState({ groups: [], statuses: [] });
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [timeline, setTimeline] = useState([]);

  const groupName = (groupId) =>
    dicts.groups.find((g) => g.group_id === groupId)?.group_name ||
    MOCK_STAGE_LABELS[Object.keys(MOCK_STAGE_LABELS)[groupId - 1]] ||
    `Група ${groupId}`;

  const statusName = (statusId) =>
    dicts.statuses.find((s) => s.status_id === statusId)?.name || `#${statusId}`;

  const stageLimits = { 1: 8, 2: 24, 3: 24, 4: 12 };

  const loadData = async () => {
    if (!projectId) return;
    const [d, o] = await Promise.all([fetchDicts(projectId), fetchOrders(projectId, filters)]);
    setDicts(d);
    setOrders(o);
  };

  // Проставити токен у клієнт при зміні стейту
  useEffect(() => {
    if (apiToken) setApiToken(apiToken);
  }, [apiToken]);

  // Ініціалізація projectId з URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('project');
    if (pid) setProjectId(Number(pid));
  }, []);

  // Обробка back/forward
  useEffect(() => {
    const handler = (e) => {
      const state = e.state;
      if (state && typeof state.projectId !== 'undefined') {
        setProjectId(state.projectId);
      } else if (!state) {
        setProjectId(null);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  useEffect(() => {
    if (!projectId) return undefined;
    loadData().catch(console.error);
    const es = openOrdersStream(projectId, () => {
      loadData().catch(console.error);
    });
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filters.from, filters.to, apiToken]);

  const filteredOrders = useMemo(() => {
    const q = filters.query.trim();
    return orders.filter((o) => (q ? String(o.order_id).includes(q) : true));
  }, [filters.query, orders]);

  const handleOpenTimeline = async (order) => {
    try {
      const res = await fetchTimeline(projectId, order.order_id);
      setTimeline(res.timeline || []);
      setSelected({
        ...order,
        timeline: res.timeline || []
      });
    } catch (e) {
      console.error(e);
    }
  };

  const stageLabels = useMemo(() => {
    const base = {};
    dicts.groups.forEach((g) => {
      base[g.group_id] = g.group_name;
    });
    return base;
  }, [dicts.groups]);

  if (!apiToken) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>Вхід</Typography>
        <Stack spacing={2} alignItems="center">
          <TextField
            label="Логін"
            size="small"
            value={credentials.username}
            onChange={(e) => setCredentials((p) => ({ ...p, username: e.target.value }))}
            sx={{ minWidth: 260 }}
          />
          <TextField
            type="password"
            label="Пароль"
            size="small"
            value={credentials.password}
            onChange={(e) => setCredentials((p) => ({ ...p, password: e.target.value }))}
            sx={{ minWidth: 260 }}
          />
          <Button
            variant="contained"
            onClick={async () => {
              try {
                const res = await login(credentials.username, credentials.password);
                if (res.token) {
                  localStorage.setItem('apiToken', res.token);
                  setToken(res.token);
                  window.history.pushState({ projectId: null }, '', window.location.pathname);
                }
              } catch (e) {
                alert(e.message);
              }
            }}
          >
            Увійти
          </Button>
        </Stack>
      </Container>
    );
  }

  if (!projectId) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>Оберіть CRM проєкт</Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          {PROJECTS.map((p) => (
            <Button
              key={p.id}
              variant="contained"
              onClick={() => {
                setProjectId(p.id);
                const url = new URL(window.location.href);
                url.searchParams.set('project', p.id);
                window.history.pushState({ projectId: p.id }, '', url.toString());
              }}
            >
              {p.name}
            </Button>
          ))}
        </Stack>
        <Button sx={{ mt: 2 }} onClick={() => { localStorage.removeItem('apiToken'); setToken(''); }}>
          Вийти
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Трекер часу — {PROJECTS.find((p) => p.id === projectId)?.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            Ланцюжок: {Object.values(stageLabels).join(' → ')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label="SLA: Новий до 12 год" color="success" variant="outlined" />
          <Chip label="Погодження/Виробництво до 24 год" color="warning" variant="outlined" />
          <Chip label="Доставка до 12 год" color="info" variant="outlined" />
          <Button
            size="small"
            variant="text"
            color="inherit"
            onClick={() => {
              setProjectId(null);
              const url = new URL(window.location.href);
              url.searchParams.delete('project');
              window.history.pushState({ projectId: null }, '', url.toString());
            }}
          >
            Змінити CRM
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            onClick={() => {
              localStorage.removeItem('apiToken');
              setToken('');
              setProjectId(null);
              const url = new URL(window.location.href);
              url.searchParams.delete('project');
              window.history.pushState({ projectId: null }, '', url.toString());
            }}
          >
            Вийти
          </Button>
        </Stack>
      </Box>

      <AnalyticsPanel orders={orders} stageLabels={stageLabels} />

      <FilterBar filters={filters} onChange={setFilters} />

      <Grid container spacing={2}>
        {filteredOrders.map((order) => (
          <Grid item xs={12} md={6} key={order.id}>
            <OrderCard
              order={{
                id: order.order_id,
                currentStatus: statusName(order.last_status_id),
                createdAt: order.started_at || order.last_changed_at,
                updatedAt: order.last_changed_at,
                stageTimes: order.stage_seconds || {},
                isUrgent: order.is_urgent
              }}
              stageLabels={stageLabels}
              stageLimits={stageLimits}
              onOpenTimeline={() => handleOpenTimeline(order)}
            />
          </Grid>
        ))}
      </Grid>

      <TimelineModal open={!!selected} order={{ ...selected, timeline }} onClose={() => setSelected(null)} />
    </Container>
  );
};

export default App;
