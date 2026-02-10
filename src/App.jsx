import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Container, Grid, Typography, Stack, Chip, Button, TextField, Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FilterBar from './components/FilterBar';
import OrderCard from './components/OrderCard';
import TimelineModal from './components/TimelineModal';
import AnalyticsPanel from './components/AnalyticsPanel';
import SettingsPanel from './components/SettingsPanel';
import ReportsPanel from './components/ReportsPanel';
import ProductivityReport from './components/ProductivityReport';
import CancellationReport from './components/CancellationReport';
import SuccessReport from './components/SuccessReport';
import SLAReport from './components/SLAReport';
import StageTimeReport from './components/StageTimeReport';
import { fetchOrders, fetchTimeline, fetchDicts, openOrdersStream, login, logout, fetchMe, fetchSettingsSLA, saveOrderOverride, fetchProjects } from './api/client';
import UsersPanel from './components/UsersPanel';
import { formatDuration } from './utils/time';
import dayjs from 'dayjs';
import { useDebouncedValue } from './hooks/useDebouncedValue';

const PROJECTS_STATIC = [];

const App = () => {
  const [filters, setFilters] = useState({
    from: dayjs().format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD'),
    query: '',
    onlyUrgent: false,
    onlyOver: false,
    slaState: '',
    stageGroup: '',
    statusId: '',
    sort: 'duration_desc' // duration_desc | duration_asc | calendar_desc | calendar_asc | date_desc | date_asc
  });
  const [dashboardLimit, setDashboardLimit] = useState(() => {
    const stored = Number(localStorage.getItem('dashboardLimit'));
    if (Number.isFinite(stored) && stored >= 10 && stored <= 5000) return stored;
    return 500;
  });
  const [projectId, setProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [userLogin, setUserLogin] = useState('');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [dicts, setDicts] = useState({ groups: [], statuses: [] });
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [slaNormal, setSlaNormal] = useState({ 1: 8, 2: 24, 3: 24, 4: 12 });
  const [slaUrgent, setSlaUrgent] = useState({ 1: 8, 2: 16, 3: 16, 4: 8 });
  const [nearThreshold, setNearThreshold] = useState(0.8);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [view, setView] = useState('dashboard'); // dashboard | reports
  const [reportTab, setReportTab] = useState('custom'); // custom | productivity | cancellation | success | sla | stage
  const [reportsOrders, setReportsOrders] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('offline'); // online | offline | connecting
  const debouncedQuery = useDebouncedValue(filters.query, 200);

  const groupName = (groupId) =>
    dicts.groups.find((g) => g.group_id === groupId)?.group_name || `Група ${groupId}`;

  const statusName = (statusId) =>
    dicts.statuses.find((s) => s.status_id === statusId)?.name || `#${statusId}`;

  const stageLimits = slaNormal;

  const loadData = async (applyFilters = true) => {
    if (!isAuthed) return;
    if (!projectId) return;
    const params = { ...filters, limit: dashboardLimit };
    if (applyFilters) {
      params.from = filters.from ? dayjs(filters.from).startOf('day').toISOString() : '';
      params.to = filters.to ? dayjs(filters.to).endOf('day').toISOString() : '';
    }
    const [d, o, sla] = await Promise.all([
      fetchDicts(projectId),
      fetchOrders(projectId, params),
      fetchSettingsSLA(projectId)
    ]);
    setDicts(d);
    setOrders(o);
    const normal = { ...slaNormal };
    const urgent = { ...slaUrgent };
    sla.rules.forEach((r) => {
      if (r.is_urgent) urgent[r.group_id] = Number(r.limit_hours);
      else normal[r.group_id] = Number(r.limit_hours);
    });
    setSlaNormal(normal);
    setSlaUrgent(urgent);
    setNearThreshold(sla.near_threshold || 0.8);
  };

  const fetchReportsData = useCallback(
    async (fromDate = '', toDate = '') => {
      if (!isAuthed || !projectId) return;
      setReportsLoading(true);
      try {
        const params = {};
        if (fromDate) params.from = dayjs(fromDate).startOf('day').toISOString();
        if (toDate) params.to = dayjs(toDate).endOf('day').toISOString();
        params.limit = 5000; // максимально широке вікно для звітів
        const data = await fetchOrders(projectId, params);
        setReportsOrders(data);
      } catch (e) {
        console.error(e);
      } finally {
        setReportsLoading(false);
      }
    },
    [projectId, isAuthed]
  );

  // Ініціалізація сесії з cookie
  useEffect(() => {
    fetchMe()
      .then((me) => {
        setIsAuthed(true);
        setUserRole(me.role || '');
        setUserLogin(me.login || '');
      })
      .catch(() => {
        setIsAuthed(false);
        setUserRole('');
        setUserLogin('');
      })
      .finally(() => setAuthChecked(true));
  }, []);

  // Ініціалізація projectId з URL + початкове завантаження списку проєктів (може дати 401 без токена)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('project');
    if (pid) setProjectId(Number(pid));

    // завантажити список проектів (після auth)
  }, []);

  // Після успішного логіну підтягуємо список проєктів
  useEffect(() => {
    if (!isAuthed) return;
    fetchProjects()
      .then((res) => setProjects(res))
      .catch(() => setProjects(PROJECTS_STATIC)); // ігноруємо, якщо тимчасово не доступно
  }, [isAuthed]);

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
    if (!projectId || !isAuthed) return undefined;
    loadData().catch((e) => {
      if (e?.code === 401 || e?.message === 'auth') {
        setIsAuthed(false);
        setUserRole('');
        setUserLogin('');
        setSnackbar({ open: true, message: 'Сесія завершена. Увійдіть знову.' });
      } else {
        console.error(e);
      }
    });
    const es = openOrdersStream(
      projectId,
      () => {
        loadData().catch(console.error);
      },
      () => {
        // Якщо SSE впав без відновлення — лише повідомляємо, без логауту
        setSnackbar({ open: true, message: 'Realtime недоступний. Дані оновлюються вручну.' });
      },
      setRealtimeStatus
    );
    return () => {
      es.close();
      setRealtimeStatus('offline');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filters.from, filters.to, isAuthed, dashboardLimit]);

  // Скидаємо/оновлюємо дані звітів окремо від дашборду
  useEffect(() => {
    setReportsOrders([]);
    if (view === 'reports' && projectId) {
      fetchReportsData();
    }
  }, [projectId, view, fetchReportsData]);

  const filteredOrders = useMemo(() => {
    const q = debouncedQuery.trim();
    const fromTs = filters.from ? dayjs(filters.from).startOf('day').valueOf() : null;
    const toTs = filters.to ? dayjs(filters.to).endOf('day').valueOf() : null;

    const getOrderSlaState = (o) => {
      if (!o.sla_states) return 'neutral';
      const values = Object.values(o.sla_states);
      if (values.some((s) => s === 'over')) return 'over';
      if (values.some((s) => s === 'near')) return 'near';
      if (values.some((s) => s === 'ok')) return 'ok';
      return 'neutral';
    };

    const list = orders.filter((o) => {
      if (q && !String(o.order_id).includes(q)) return false;
      if (filters.onlyUrgent && !o.is_urgent) return false;
      if (filters.onlyOver) {
        const hasOver = o.sla_states && Object.values(o.sla_states).some((s) => s === 'over');
        if (!hasOver) return false;
      }
      if (filters.slaState) {
        const state = getOrderSlaState(o);
        if (state !== filters.slaState) return false;
      }
      const createdAtTs = o.order_created_at ? new Date(o.order_created_at).getTime() : null;
      const fallbackDate = o.started_at ? new Date(o.started_at).getTime() : o.last_changed_at ? new Date(o.last_changed_at).getTime() : null;
      const dateTs = createdAtTs ?? fallbackDate;
      if (filters.stageGroup && String(o.last_status_group_id) !== String(filters.stageGroup)) return false;
      if (filters.statusId && String(o.last_status_id) !== String(filters.statusId)) return false;
      if (fromTs !== null) {
        if (dateTs === null) return false;
        if (dateTs < fromTs) return false;
      }
      if (toTs !== null) {
        if (dateTs === null) return false;
        if (dateTs > toTs) return false;
      }
      return true;
    });

    const workingDuration = (o) => {
      if (o.cycle_seconds != null) return o.cycle_seconds;
      if (o.stage_seconds) return Object.values(o.stage_seconds).reduce((s, v) => s + (v || 0), 0);
      return 0;
    };
    const calendarDuration = (o) => {
      if (o.start_at && o.end_at) {
        const start = new Date(o.start_at).getTime();
        const end = new Date(o.end_at).getTime();
        if (Number.isFinite(start) && Number.isFinite(end)) return Math.max(0, (end - start) / 1000);
      }
      if (o.stage_calendar_seconds) return Object.values(o.stage_calendar_seconds).reduce((s, v) => s + (v || 0), 0);
      return 0;
    };
    const createdTs = (o) => new Date(o.order_created_at || o.started_at || o.last_changed_at || 0).getTime();

    const sorted = [...list];
    switch (filters.sort) {
      case 'duration_asc':
        sorted.sort((a, b) => workingDuration(a) - workingDuration(b));
        break;
      case 'calendar_asc':
        sorted.sort((a, b) => calendarDuration(a) - calendarDuration(b));
        break;
      case 'id_desc':
        sorted.sort((a, b) => (b.order_id || 0) - (a.order_id || 0));
        break;
      case 'id_asc':
        sorted.sort((a, b) => (a.order_id || 0) - (b.order_id || 0));
        break;
      case 'date_desc':
        sorted.sort((a, b) => createdTs(b) - createdTs(a));
        break;
      case 'date_asc':
        sorted.sort((a, b) => createdTs(a) - createdTs(b));
        break;
      case 'calendar_desc':
        sorted.sort((a, b) => calendarDuration(b) - calendarDuration(a));
        break;
      case 'duration_desc':
      default:
        sorted.sort((a, b) => workingDuration(b) - workingDuration(a));
        break;
    }
    return sorted;
  }, [filters, orders]);

  const handleOpenTimeline = async (order) => {
    try {
      const res = await fetchTimeline(projectId, order.order_id);
      const mapped = (res.timeline || []).map((t) => ({
        stage: stageLabels[t.status_group_id] || `Група ${t.status_group_id}`,
        status: statusName(t.status_id),
        enteredAt: t.entered_at,
        leftAt: t.left_at,
        group_id: t.status_group_id
      }));
      setTimeline(mapped);
      setSelected({
        ...order,
        timeline: mapped
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

  const handleToggleUrgent = async (order) => {
    try {
      await saveOrderOverride(projectId, order.order_id || order.id, {
        is_urgent_override: !order.isUrgent
      });
      await loadData(false);
    } catch (e) {
      console.error(e);
      alert('Не вдалося змінити терміновість');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // ignore
    } finally {
      setIsAuthed(false);
      setUserRole('');
      setUserLogin('');
      setProjectId(null);
      setRealtimeStatus('offline');
      const url = new URL(window.location.href);
      url.searchParams.delete('project');
      window.history.pushState({ projectId: null }, '', url.toString());
    }
  };

  if (!authChecked) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">Завантаження...</Typography>
      </Container>
    );
  }

  if (!isAuthed) {
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
                if (res.role) setUserRole(res.role);
                if (res.login) setUserLogin(res.login);
                setIsAuthed(true);
                window.history.pushState({ projectId: null }, '', window.location.pathname);
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
      <>
        <Dialog
          open={showUsers}
          onClose={() => setShowUsers(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Користувачі
            <IconButton size="small" onClick={() => setShowUsers(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <UsersPanel projects={projects} currentRole={userRole} />
          </DialogContent>
        </Dialog>

        <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>Оберіть CRM проєкт</Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          {projects.map((p) => (
            <Button
              key={p.id}
              variant="contained"
              onClick={() => {
                setProjectId(p.id);
                setShowUsers(false);
                const url = new URL(window.location.href);
                url.searchParams.set('project', p.id);
                window.history.pushState({ projectId: p.id }, '', url.toString());
              }}
            >
              {p.name}
            </Button>
          ))}
        </Stack>
        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
          {(userRole === 'admin' || userRole === 'super_admin') && (
            <Button variant="outlined" onClick={() => setShowUsers(true)}>
              Користувачі
            </Button>
          )}
          <Button onClick={() => { setShowUsers(false); handleLogout(); }}>
            Вийти
          </Button>
        </Stack>
        </Container>
      </>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {snackbar.open && (
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: '#fff',
            px: 2,
            py: 1,
            borderRadius: 1,
            zIndex: 2000
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">{snackbar.message}</Typography>
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setSnackbar({ open: false, message: '' })}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      )}
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
            Трекер часу — {projects.find((p) => p.id === projectId)?.name || `Проєкт #${projectId}`}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '100%', display: 'block' }}>
            Ланцюжок: {Object.values(stageLabels).join(' → ')}
          </Typography>
          {userRole && (
            <Typography variant="body2" color="text.secondary" noWrap>
              Користувач: {userLogin || '—'} ({userRole})
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
          {realtimeStatus !== 'online' && (
            <Chip
              label={realtimeStatus === 'connecting' ? 'Realtime connecting' : 'Realtime offline'}
              color="warning"
              variant="outlined"
              size="small"
            />
          )}
          {Object.entries(stageLimits).map(([gid, limit]) => {
            const urgent = slaUrgent[gid] ?? limit;
            const label = stageLabels[gid] || `Група ${gid}`;
    const fmt = (v) => formatDuration((v || 0) * 3600);
            return (
              <Box
                key={gid}
                sx={{
                  border: '1px solid',
                  borderColor:
                    Number(gid) === 1 ? 'success.main' : Number(gid) === 4 ? 'info.main' : 'warning.main',
                  borderRadius: 10,
                  px: 1.25,
                  py: 0.75,
                  minWidth: 120,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  textAlign: 'center'
                }}
              >
                <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>
                  {label}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>
                  ЗВ: {fmt(limit)}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>
                  ТР: {fmt(urgent)}
                </Typography>
              </Box>
            );
          })}
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
            onClick={handleLogout}
          >
            Вийти
          </Button>
        </Stack>
      </Box>

      <Box display="flex" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button
          size="small"
          variant={view === 'dashboard' ? 'contained' : 'outlined'}
          sx={{ mr: 1 }}
          onClick={() => setView('dashboard')}
        >
          Дашборд
        </Button>
        <Button
          size="small"
          variant={view === 'reports' ? 'contained' : 'outlined'}
          onClick={() => setView('reports')}
        >
          Звіти
        </Button>
        {userRole !== 'user' && (
          <Button size="small" variant="outlined" onClick={() => setShowSettings(true)}>
            Налаштування
          </Button>
        )}
      </Box>

      <Dialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Налаштування
          <IconButton size="small" onClick={() => setShowSettings(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <SettingsPanel
            projectId={projectId}
            groups={dicts.groups}
            statuses={dicts.statuses}
            slaNormal={slaNormal}
            slaUrgent={slaUrgent}
            nearThreshold={nearThreshold}
            dashboardLimit={dashboardLimit}
            onDashboardLimitChange={(val) => {
              const next = val || 500;
              setDashboardLimit(next);
              localStorage.setItem('dashboardLimit', String(next));
              loadData(true);
            }}
            onSlaSaved={(normal, urgent, t) => {
              setSlaNormal(normal);
              setSlaUrgent(urgent);
              if (t) setNearThreshold(t);
            }}
            onNearChange={(t) => setNearThreshold(t)}
            onCycleSaved={() => loadData(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={showUsers}
        onClose={() => setShowUsers(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Користувачі
          <IconButton size="small" onClick={() => setShowUsers(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <UsersPanel
            projects={projects}
            currentRole={userRole}
          />
        </DialogContent>
      </Dialog>

      {view === 'dashboard' && (
        <>
          <AnalyticsPanel orders={orders} stageLabels={stageLabels} />
          <FilterBar
            filters={filters}
            onChange={setFilters}
            onSubmit={() => loadData(true)}
            stageOptions={dicts.groups.map((g) => ({ id: g.group_id, name: g.group_name }))}
            statusOptions={dicts.statuses.map((s) => ({ id: s.status_id, name: s.name, group_id: s.group_id }))}
          />
          {filteredOrders.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              За вибраними фільтрами замовлень немає.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {filteredOrders.map((order) => (
                <Grid item xs={12} key={order.order_id || order.id}>
                  <OrderCard
                    order={{
                      id: order.order_id,
                      currentStatus: statusName(order.last_status_id),
                      createdAt: order.order_created_at || order.started_at || order.last_changed_at,
                      updatedAt: order.last_changed_at,
                      stageTimes: order.stage_seconds || {},
                      isUrgent: order.is_urgent,
                      urgentRule: order.urgent_rule
                    }}
                    stageLabels={stageLabels}
                    stageLimits={order.is_urgent ? slaUrgent : stageLimits}
                    nearThreshold={nearThreshold}
                    onOpenTimeline={() => handleOpenTimeline(order)}
                    onToggleUrgent={handleToggleUrgent}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {view === 'reports' && (
        <>
          <Stack direction="row" spacing={1} mb={2}>
            <Button
              size="small"
              variant={reportTab === 'custom' ? 'contained' : 'outlined'}
              onClick={() => setReportTab('custom')}
            >
              Кастомний звіт
            </Button>
            <Button
              size="small"
              variant={reportTab === 'productivity' ? 'contained' : 'outlined'}
              onClick={() => setReportTab('productivity')}
            >
              Звіт продуктивності
            </Button>
            <Button
              size="small"
              variant={reportTab === 'cancellation' ? 'contained' : 'outlined'}
              onClick={() => setReportTab('cancellation')}
            >
              Відміни
            </Button>
            <Button
              size="small"
              variant={reportTab === 'success' ? 'contained' : 'outlined'}
              onClick={() => setReportTab('success')}
            >
              Успішність
            </Button>
            <Button
              size="small"
              variant={reportTab === 'sla' ? 'contained' : 'outlined'}
              onClick={() => setReportTab('sla')}
            >
              SLA
            </Button>
            <Button
              size="small"
              variant={reportTab === 'stage' ? 'contained' : 'outlined'}
              onClick={() => setReportTab('stage')}
            >
              Час по етапах
            </Button>
          </Stack>

          {reportTab === 'custom' && (
            <ReportsPanel
              orders={reportsOrders}
              stageLabels={stageLabels}
              statuses={dicts.statuses.map((s) => ({ id: s.status_id, name: s.name, group_id: s.group_id }))}
              onFetch={fetchReportsData}
              loading={reportsLoading}
              onOpenOrder={handleOpenTimeline}
            />
          )}

          {reportTab === 'productivity' && (
            <ProductivityReport
              orders={reportsOrders}
              stageLabels={stageLabels}
              onFetch={fetchReportsData}
              onOpenOrder={handleOpenTimeline}
            />
          )}

          {reportTab === 'cancellation' && (
            <CancellationReport
              orders={reportsOrders}
              stageLabels={stageLabels}
              statuses={dicts.statuses.map((s) => ({ id: s.status_id, name: s.name, group_id: s.group_id }))}
              onFetch={fetchReportsData}
              onOpenOrder={handleOpenTimeline}
            />
          )}

          {reportTab === 'success' && (
            <SuccessReport
              orders={reportsOrders}
              stageLabels={stageLabels}
              onFetch={fetchReportsData}
              onOpenOrder={handleOpenTimeline}
            />
          )}

          {reportTab === 'sla' && (
            <SLAReport
              orders={reportsOrders}
              stageLabels={stageLabels}
              statuses={dicts.statuses.map((s) => ({ id: s.status_id, name: s.name }))}
              onFetch={fetchReportsData}
              onOpenOrder={handleOpenTimeline}
            />
          )}

          {reportTab === 'stage' && (
            <StageTimeReport
              orders={reportsOrders}
              stageLabels={stageLabels}
              onFetch={fetchReportsData}
              onOpenOrder={handleOpenTimeline}
            />
          )}
        </>
      )}

      <TimelineModal
        open={!!selected}
        order={{ ...selected, timeline }}
        onClose={() => setSelected(null)}
      />
    </Container>
  );
};

export default App;
