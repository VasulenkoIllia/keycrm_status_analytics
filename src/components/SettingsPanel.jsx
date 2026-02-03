import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Stack,
  Divider,
  Chip,
  Tooltip,
  IconButton
} from '@mui/material';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  fetchSettingsCycle,
  fetchSettingsSLA,
  fetchWorkingHours,
  fetchProjectSettings,
  fetchUrgentRules,
  saveOrderOverride,
  saveSettingsCycle,
  saveSettingsSLA,
  saveWorkingHours,
  saveProjectSettings,
  saveUrgentRules
} from '../api/client';

const DEFAULT_SLA = {
  normal: { 1: 8, 2: 24, 3: 24, 4: 12 },
  urgent: { 1: 8, 2: 16, 3: 16, 4: 8 }
};

const WEEKDAYS = [
  { id: 0, label: 'Пн' },
  { id: 1, label: 'Вт' },
  { id: 2, label: 'Ср' },
  { id: 3, label: 'Чт' },
  { id: 4, label: 'Пт' },
  { id: 5, label: 'Сб' },
  { id: 6, label: 'Нд' }
];

export default function SettingsPanel({
  projectId,
  groups = [],
  statuses = [],
  slaNormal,
  slaUrgent,
  nearThreshold: nearThresholdProp = 0.8,
  onSlaSaved = () => {},
  onNearChange = () => {},
  onCycleSaved = () => {}
}) {
  const [cycle, setCycle] = useState({ cycles: [], default_cycle_id: null });
  const [sla, setSla] = useState(DEFAULT_SLA);
  const [startGroup, setStartGroup] = useState(1);
  const [endGroup, setEndGroup] = useState(4);
  const [startStatus, setStartStatus] = useState('');
  const [endStatus, setEndStatus] = useState('');
  const [working, setWorking] = useState({});
  const [projectInfo, setProjectInfo] = useState({ name: '', base_url: '', api_token: '' });
  const [savingProject, setSavingProject] = useState(false);
  const [urgentRules, setUrgentRules] = useState([]);
  const [savingUrgent, setSavingUrgent] = useState(false);
  const [nearThreshold, setNearThreshold] = useState(80); // %
  const [overrideOrderId, setOverrideOrderId] = useState('');
  const [overrideUrgent, setOverrideUrgent] = useState('none'); // none/true/false
  const [savingOverride, setSavingOverride] = useState(false);
  const [activeSection, setActiveSection] = useState('project');

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      fetchSettingsCycle(projectId),
      fetchSettingsSLA(projectId),
      fetchWorkingHours(projectId),
      fetchProjectSettings(projectId),
      fetchUrgentRules(projectId)
    ])
      .then(([c, s, w, p, ur]) => {
        setCycle(c);
        const defaults = { normal: { ...DEFAULT_SLA.normal }, urgent: { ...DEFAULT_SLA.urgent } };
        s.rules.forEach((r) => {
          if (r.is_urgent) defaults.urgent[r.group_id] = Number(r.limit_hours);
          else defaults.normal[r.group_id] = Number(r.limit_hours);
        });
        setNearThreshold(Math.round((s.near_threshold || 0.8) * 100));
        setSla(defaults);
        const current = c.cycles?.find((x) => x.id === c.default_cycle_id);
        if (current) {
          setStartGroup(current.start_group_id || 1);
          setEndGroup(current.end_group_id || 4);
          setStartStatus(current.start_status_id || '');
          setEndStatus(current.end_status_id || '');
        }
        const wmap = {};
        (w.rules || []).forEach((r) => {
          const gid = r.group_id;
          if (!wmap[gid]) wmap[gid] = {};
          wmap[gid][r.weekday] = r.ranges || [];
        });
        setWorking(wmap);
        setProjectInfo({
          name: p?.name || '',
          base_url: p?.base_url || '',
          api_token: p?.api_token || '',
          webhook_url: p?.webhook_url || '',
          webhook_token: p?.webhook_token || ''
        });
        setUrgentRules(ur.rules || []);
      })
      .catch(console.error);
  }, [projectId]);

  const statusesByGroup = useMemo(() => (gid) => statuses.filter((s) => s.group_id === Number(gid)), [statuses]);

  useEffect(() => {
    if (slaNormal && slaUrgent) {
      setSla({ normal: { ...slaNormal }, urgent: { ...slaUrgent } });
    }
  }, [slaNormal, slaUrgent]);

  useEffect(() => {
    setNearThreshold(Math.round((nearThresholdProp || 0.8) * 100));
  }, [nearThresholdProp]);

  const handleSaveSLA = async () => {
    const rules = [
      ...Object.entries(sla.normal).map(([g, val]) => ({
        group_id: Number(g),
        is_urgent: false,
        limit_hours: Number(val)
      })),
      ...Object.entries(sla.urgent).map(([g, val]) => ({
        group_id: Number(g),
        is_urgent: true,
        limit_hours: Number(val)
      }))
    ];
    const res = await saveSettingsSLA(projectId, { rules, near_threshold: nearThreshold / 100 });
    const normal = { ...sla.normal };
    const urgent = { ...sla.urgent };
    res.rules.forEach((r) => {
      if (r.is_urgent) urgent[r.group_id] = Number(r.limit_hours);
      else normal[r.group_id] = Number(r.limit_hours);
    });
    setSla({ normal, urgent });
    const savedThreshold = res.near_threshold || nearThreshold / 100;
    setNearThreshold(Math.round(savedThreshold * 100));
    onSlaSaved(normal, urgent, savedThreshold);
    onNearChange(savedThreshold);
  };

  const handleSaveCycle = async () => {
    const currentId = cycle.default_cycle_id || cycle.cycles[0]?.id || null;
    const res = await saveSettingsCycle(projectId, {
      cycle_rule_id: currentId,
      start_group_id: Number(startGroup),
      end_group_id: Number(endGroup),
      start_status_id: startStatus ? Number(startStatus) : null,
      end_status_id: endStatus ? Number(endStatus) : null
    });
    setCycle(res);
    onCycleSaved(res);
  };

  const groupLabel = (gid) => groups.find((g) => g.group_id === Number(gid))?.group_name || `Група ${gid}`;
  const workingFor = (gid) => working[gid] || {};
  const setDayRanges = (gid, weekday, ranges) => {
    setWorking((prev) => {
      const next = { ...prev };
      next[gid] = { ...(next[gid] || {}), [weekday]: ranges };
      return next;
    });
  };

  const applyPreset247 = (gid) => {
    setWorking((prev) => {
      const next = { ...prev };
      delete next[gid];
      return next;
    });
  };

  const applyPresetWorkweek = (gid) => {
    const base = {};
    WEEKDAYS.forEach((d) => {
      base[d.id] = d.id <= 4 ? [{ start: '09:00', end: '18:00' }] : [];
    });
    setWorking((prev) => ({ ...prev, [gid]: base }));
  };

  const timeToString = (val) => {
    const total = Number(val) || 0;
    const hours = Math.floor(total);
    const minutes = Math.round((total - hours) * 60);
    const mm = String(minutes).padStart(2, '0');
    return `${hours}:${mm}`;
  };

  const parseTimeInput = (str) => {
    if (typeof str !== 'string') return 0;
    const trimmed = str.trim();
    if (!trimmed) return 0;
    if (trimmed.includes(':')) {
      const [h, m] = trimmed.split(':');
      const hours = Number(h) || 0;
      let minutes = Number(m) || 0;
      minutes = Math.min(Math.max(minutes, 0), 59);
      return hours + minutes / 60;
    }
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : 0;
  };

  const normalizeTime = (val) => {
    if (typeof val !== 'string') return '00:00';
    const parts = val.split(':');
    const hNum = Number(parts[0]);
    const mNum = Number(parts[1]);
    const h = String(
      Number.isFinite(hNum) ? Math.min(Math.max(Math.floor(hNum), 0), 23) : 0
    ).padStart(2, '0');
    const m = String(
      Number.isFinite(mNum) ? Math.min(Math.max(Math.floor(mNum), 0), 59) : 0
    ).padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleSaveWorking = async () => {
    const rules = [];
    const allDays = [0, 1, 2, 3, 4, 5, 6];

    // Формуємо мапу з дефолтом 24/7, якщо для групи немає жодного діапазону
    const effective = { ...working };
    (groups || []).forEach((g) => {
      const gid = g.group_id;
      const days = effective[gid];
      const hasRanges =
        days && Object.values(days).some((ranges) => Array.isArray(ranges) && ranges.length > 0);
      if (!hasRanges) {
        const full = {};
        allDays.forEach((d) => {
          full[d] = [{ start: '00:00', end: '23:59' }];
        });
        effective[gid] = full;
      }
    });

    Object.entries(effective).forEach(([gid, days]) => {
      Object.entries(days).forEach(([weekday, ranges]) => {
        const normalized = (ranges || [])
          .map((r) => ({
            start: normalizeTime(r.start),
            end: normalizeTime(r.end)
          }))
          .filter((r) => r.start < r.end);
        rules.push({
          group_id: Number(gid),
          weekday: Number(weekday),
          ranges: normalized
        });
      });
    });
    // allow day-off (empty array), but ensure group/day exists at least as empty
    const res = await saveWorkingHours(projectId, rules);
    const wmap = {};
    (res.rules || []).forEach((r) => {
      if (!wmap[r.group_id]) wmap[r.group_id] = {};
      wmap[r.group_id][r.weekday] = r.ranges || [];
    });
    setWorking(wmap);
  };

  const handleSaveProject = async () => {
    if (!projectId) return;
    setSavingProject(true);
    try {
      const payload = {
        name: projectInfo.name || null,
        base_url: projectInfo.base_url || null,
        api_token: projectInfo.api_token || null,
        webhook_url: projectInfo.webhook_url || null,
        webhook_token: projectInfo.webhook_token || null
      };
      const res = await saveProjectSettings(projectId, payload);
      setProjectInfo({
        name: res.name || '',
        base_url: res.base_url || '',
        api_token: res.api_token || '',
        webhook_url: res.webhook_url || '',
        webhook_token: res.webhook_token || ''
      });
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingProject(false);
    }
  };

  const handleAddUrgentRule = () => {
    setUrgentRules((prev) => [
      ...prev,
      { rule_name: 'Rule', match_type: 'sku', match_value: '', is_active: true }
    ]);
  };

  const handleSaveUrgent = async () => {
    if (!projectId) return;
    setSavingUrgent(true);
    try {
      const cleaned = urgentRules.filter((r) => r.match_value && r.match_type);
      const res = await saveUrgentRules(projectId, cleaned);
      setUrgentRules(res.rules || []);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingUrgent(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!projectId || !overrideOrderId) return;
    setSavingOverride(true);
    try {
      const payload = {
        is_urgent_override:
          overrideUrgent === 'none' ? null : overrideUrgent === 'true'
      };
      await saveOrderOverride(projectId, Number(overrideOrderId), payload);
      alert('Override збережено');
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingOverride(false);
    }
  };

  const navItems = [
    { key: 'project', label: 'Проєкт / API' },
    { key: 'urgent', label: 'Правила терміновості' },
    { key: 'cycle', label: 'Цикл' },
    { key: 'sla', label: 'SLA' },
    { key: 'working', label: 'Робочі години' },
    { key: 'override', label: 'Ручний override' }
  ];

  const projectCard = (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>API проєкту</Typography>
        <Typography variant="body2" color="text.secondary">
          Базовий URL (з `/v1`) та API Token для запитів до KeyCRM. Токен зберігається в БД проєкту.
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Назва проєкту"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={projectInfo.name}
              onChange={(e) => setProjectInfo((p) => ({ ...p, name: e.target.value }))}
              disabled={!projectId}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Base URL"
              placeholder="https://openapi.keycrm.app/v1"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={projectInfo.base_url}
              onChange={(e) => setProjectInfo((p) => ({ ...p, base_url: e.target.value }))}
              disabled={!projectId}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="API Token"
              size="small"
              type="password"
              InputLabelProps={{ shrink: true }}
              value={projectInfo.api_token}
              onChange={(e) => setProjectInfo((p) => ({ ...p, api_token: e.target.value }))}
              disabled={!projectId}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Webhook URL"
              size="small"
              placeholder="https://your-host/webhooks/keycrm?project=ID"
              InputLabelProps={{ shrink: true }}
              value={projectInfo.webhook_url}
              onChange={(e) => setProjectInfo((p) => ({ ...p, webhook_url: e.target.value }))}
              disabled={!projectId}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Webhook Token"
              size="small"
              type="password"
              InputLabelProps={{ shrink: true }}
              value={projectInfo.webhook_token}
              onChange={(e) => setProjectInfo((p) => ({ ...p, webhook_token: e.target.value }))}
              helperText="Додається у заголовок x-webhook-token або ?token="
              disabled={!projectId}
            />
          </Grid>
          <Grid item xs={12}>
            <Stack direction="row" spacing={2}>
              <Button variant="contained" onClick={handleSaveProject} disabled={!projectId || savingProject}>
                {savingProject ? 'Збереження...' : 'Зберегти API налаштування'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const urgentCard = (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Правила терміновості</Typography>
        <Typography variant="body2" color="text.secondary">
          Правила визначають термінові замовлення за sku / offer_id / product_id. Порожнє значення — правило не збережеться.
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {urgentRules.map((r, idx) => (
            <Grid container spacing={1} key={idx} alignItems="center">
              <Grid item xs={12} sm={3} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Назва"
                  value={r.rule_name || ''}
                  onChange={(e) => {
                    const next = [...urgentRules];
                    next[idx] = { ...next[idx], rule_name: e.target.value };
                    setUrgentRules(next);
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={3} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Поле"
                  value={r.match_type}
                  onChange={(e) => {
                    const next = [...urgentRules];
                    next[idx] = { ...next[idx], match_type: e.target.value };
                    setUrgentRules(next);
                  }}
                >
                  <MenuItem value="sku">sku</MenuItem>
                  <MenuItem value="offer_id">offer_id</MenuItem>
                  <MenuItem value="product_id">product_id</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Значення"
                  value={r.match_value || ''}
                  onChange={(e) => {
                    const next = [...urgentRules];
                    next[idx] = { ...next[idx], match_value: e.target.value };
                    setUrgentRules(next);
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={2} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Активне"
                  value={r.is_active ? '1' : '0'}
                  onChange={(e) => {
                    const next = [...urgentRules];
                    next[idx] = { ...next[idx], is_active: e.target.value === '1' };
                    setUrgentRules(next);
                  }}
                >
                  <MenuItem value="1">Так</MenuItem>
                  <MenuItem value="0">Ні</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={12} md={3}>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setUrgentRules((prev) => prev.filter((_, i) => i !== idx));
                    }}
                  >
                    Видалити
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          ))}
          <Button size="small" variant="text" onClick={handleAddUrgentRule}>Додати правило</Button>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Button variant="contained" onClick={handleSaveUrgent} disabled={savingUrgent}>
              {savingUrgent ? 'Збереження...' : 'Зберегти правила'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  const cycleCard = (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Налаштування циклу</Typography>
        <Typography variant="body2" color="text.secondary">
          Оберіть старт/фініш групи або конкретний статус (якщо статус задано — він пріоритетний).
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              SelectProps={{ native: true }}
              label="Старт група"
              value={startGroup}
              onChange={(e) => setStartGroup(e.target.value)}
              size="small"
            >
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>{g.group_name || g.group_id}</option>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Старт статус"
              value={startStatus}
              onChange={(e) => setStartStatus(e.target.value)}
              size="small"
            >
              <MenuItem value="">(усі у групі)</MenuItem>
              {statusesByGroup(startGroup).map((s) => (
                <MenuItem key={s.status_id} value={s.status_id}>{s.name || s.status_id}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              SelectProps={{ native: true }}
              label="Фініш група"
              value={endGroup}
              onChange={(e) => setEndGroup(e.target.value)}
              size="small"
            >
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>{g.group_name || g.group_id}</option>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Фініш статус"
              value={endStatus}
              onChange={(e) => setEndStatus(e.target.value)}
              size="small"
            >
              <MenuItem value="">(усі у групі)</MenuItem>
              {statusesByGroup(endGroup).map((s) => (
                <MenuItem key={s.status_id} value={s.status_id}>{s.name || s.status_id}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <Button variant="contained" size="small" fullWidth onClick={handleSaveCycle}>Зберегти цикл</Button>
          </Grid>
          <Grid item xs={12}>
            {cycle.cycles?.map((c) => (
              <Card key={c.id} variant="outlined" sx={{ p: 1.5, bgcolor: c.id === cycle.default_cycle_id ? 'rgba(124,141,242,0.1)' : 'transparent', mb: 1 }}>
                <Typography variant="subtitle2">{c.title || 'Цикл'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Старт: group {c.start_group_id || '-'} / status {c.start_status_id || '-'}<br />
                  Фініш: group {c.end_group_id || '-'} / status {c.end_status_id || '-'}
                </Typography>
              </Card>
            ))}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const slaCard = (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>SLA (години)</Typography>
        <Typography variant="subtitle2" sx={{ mt: 1 }}>Звичайні</Typography>
        <Grid container spacing={2} sx={{ mt: 1, mb: 2 }}>
          {Object.entries(sla.normal).map(([g, val]) => (
            <Grid item xs={12} sm={6} md={3} key={`n-${g}`}>
              <TextField
                fullWidth
                label={groupLabel(g)}
                size="small"
                placeholder="год:хв"
                value={timeToString(val)}
                inputProps={{ style: { textAlign: 'center' } }}
                onChange={(e) => {
                  const hours = parseTimeInput(e.target.value);
                  setSla((p) => ({ ...p, normal: { ...p.normal, [g]: hours } }));
                }}
              />
            </Grid>
          ))}
        </Grid>
        <Typography variant="subtitle2" sx={{ mt: 1 }}>Термінові</Typography>
        <Grid container spacing={2} sx={{ mt: 1, mb: 2 }}>
          {Object.entries(sla.urgent).map(([g, val]) => (
            <Grid item xs={12} sm={6} md={3} key={`u-${g}`}>
              <TextField
                fullWidth
                label={groupLabel(g)}
                size="small"
                placeholder="год:хв"
                value={timeToString(val)}
                inputProps={{ style: { textAlign: 'center' } }}
                onChange={(e) => {
                  const hours = parseTimeInput(e.target.value);
                  setSla((p) => ({ ...p, urgent: { ...p.urgent, [g]: hours } }));
                }}
              />
            </Grid>
          ))}
        </Grid>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="Поріг Near (%)"
            size="small"
            type="number"
            inputProps={{ min: 50, max: 99 }}
            value={nearThreshold}
            onChange={(e) => {
              const v = Math.min(99, Math.max(0, Number(e.target.value) || 0));
              setNearThreshold(v);
            }}
            helperText="Коли етап вичерпав цей % від ліміту — переходить у Near (за замовч. 80%)"
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={handleSaveSLA}>Зберегти SLA</Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Зберігає ліміти для звичайних замовлень; термінові можна додати окремо при потребі.
        </Typography>
      </CardContent>
    </Card>
  );

  const overrideCard = (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Ручний override замовлення</Typography>
        <Typography variant="body2" color="text.secondary">
          Примусово задає терміновість для конкретного order_id.
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Order ID"
              value={overrideOrderId}
              onChange={(e) => setOverrideOrderId(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              size="small"
              label="Терміновість"
              value={overrideUrgent}
              onChange={(e) => setOverrideUrgent(e.target.value)}
            >
              <MenuItem value="none">(без зміни)</MenuItem>
              <MenuItem value="true">Термінове</MenuItem>
              <MenuItem value="false">Звичайне</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <Stack direction="row" spacing={2}>
              <Button variant="contained" onClick={handleSaveOverride} disabled={savingOverride || !overrideOrderId}>
                {savingOverride ? 'Збереження...' : 'Зберегти override'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const workingCard = (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Робочі дні та години (по етапах)</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Якщо етап не налаштований — працює 24/7 за замовчуванням. Порожній список інтервалів означає вихідний день.
        </Typography>

        <Stack spacing={3}>
          {groups.map((g) => {
            const cfg = workingFor(g.group_id);
            const isDefault = Object.keys(cfg).length === 0;
            return (
              <Card key={g.group_id} variant="outlined" sx={{ bgcolor: '#0f1219' }}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" rowGap={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1">{g.group_name || `Група ${g.group_id}`}</Typography>
                      <Chip size="small" label={isDefault ? '24/7 (за замовчуванням)' : 'Кастомний графік'} color={isDefault ? 'default' : 'info'} />
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="text" onClick={() => applyPreset247(g.group_id)}>24/7</Button>
                      <Button size="small" variant="text" onClick={() => applyPresetWorkweek(g.group_id)}>Пн–Пт 09–18</Button>
                    </Stack>
                  </Stack>

                  {!isDefault && (
                    <Grid container spacing={1} sx={{ mt: 1 }}>
                      {WEEKDAYS.map((d) => {
                        const ranges = cfg[d.id] || [];
                        return (
                          <Grid item xs={12} md={6} key={`${g.group_id}-${d.id}`}>
                            <Card variant="outlined" sx={{ p: 1.5, bgcolor: '#0c0f15' }}>
                              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                <Typography variant="subtitle2">{d.label}</Typography>
                                <Stack direction="row" spacing={0.5}>
                                  <Button size="small" variant="text" onClick={() => setDayRanges(g.group_id, d.id, [])}>
                                    Вихідний
                                  </Button>
                                  <Tooltip title="Додати інтервал">
                                    <IconButton size="small" onClick={() => setDayRanges(g.group_id, d.id, [...ranges, { start: '09:00', end: '18:00' }])}>
                                      <AddIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </Stack>
                              {ranges.length === 0 ? (
                                <Typography variant="caption" color="text.secondary">Вихідний</Typography>
                              ) : (
                                <Stack spacing={1} sx={{ mt: 1 }}>
                                  {ranges.map((r, idx) => (
                                    <Stack direction="row" spacing={1} alignItems="center" key={idx}>
                                      <TextField
                                        size="small"
                                        type="time"
                                        label="Початок"
                                        value={r.start}
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ step: 300 }}
                                        onChange={(e) => {
                                          const next = ranges.map((it, j) => (j === idx ? { ...it, start: e.target.value } : it));
                                          setDayRanges(g.group_id, d.id, next);
                                        }}
                                        sx={{ width: 110 }}
                                      />
                                      <TextField
                                        size="small"
                                        type="time"
                                        label="Кінець"
                                        value={r.end}
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ step: 300 }}
                                        onChange={(e) => {
                                          const next = ranges.map((it, j) => (j === idx ? { ...it, end: e.target.value } : it));
                                          setDayRanges(g.group_id, d.id, next);
                                        }}
                                        sx={{ width: 110 }}
                                      />
                                      <IconButton size="small" onClick={() => {
                                        const next = ranges.filter((_, j) => j !== idx);
                                        setDayRanges(g.group_id, d.id, next);
                                      }}>
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Stack>
                                  ))}
                                </Stack>
                              )}
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  )}

                  {isDefault && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Використовує 24/7. Натисніть пресет або додайте інтервал, щоб налаштувати графік.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button variant="contained" onClick={handleSaveWorking}>Зберегти робочі години</Button>
        </Stack>
      </CardContent>
    </Card>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'project':
        return projectCard;
      case 'urgent':
        return urgentCard;
      case 'cycle':
        return cycleCard;
      case 'sla':
        return slaCard;
      case 'working':
        return workingCard;
      case 'override':
        return overrideCard;
      default:
        return null;
    }
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>Розділи</Typography>
            <Stack spacing={1}>
              {navItems.map((item) => (
                <Button
                  key={item.key}
                  variant={activeSection === item.key ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setActiveSection(item.key)}
                  fullWidth
                >
                  {item.label}
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={9}>
        <Stack spacing={2}>
          {renderSection()}
        </Stack>
      </Grid>
    </Grid>
  );
}
