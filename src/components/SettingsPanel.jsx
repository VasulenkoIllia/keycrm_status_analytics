import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, Typography, Grid, TextField, Button, Stack, Divider } from '@mui/material';
import MenuItem from '@mui/material/MenuItem';
import { fetchSettingsCycle, fetchSettingsSLA, saveSettingsCycle, saveSettingsSLA } from '../api/client';

const DEFAULT_SLA = {
  normal: { 1: 8, 2: 24, 3: 24, 4: 12 },
  urgent: { 1: 8, 2: 16, 3: 16, 4: 8 }
};

export default function SettingsPanel({
  projectId,
  groups = [],
  statuses = [],
  slaNormal,
  slaUrgent,
  onSlaSaved = () => {},
  onCycleSaved = () => {}
}) {
  const [cycle, setCycle] = useState({ cycles: [], default_cycle_id: null });
  const [sla, setSla] = useState(DEFAULT_SLA);
  const [startGroup, setStartGroup] = useState(1);
  const [endGroup, setEndGroup] = useState(4);
  const [startStatus, setStartStatus] = useState('');
  const [endStatus, setEndStatus] = useState('');

  useEffect(() => {
    if (!projectId) return;
    Promise.all([fetchSettingsCycle(projectId), fetchSettingsSLA(projectId)])
      .then(([c, s]) => {
        setCycle(c);
        const defaults = { normal: { ...DEFAULT_SLA.normal }, urgent: { ...DEFAULT_SLA.urgent } };
        s.rules.forEach((r) => {
          if (r.is_urgent) defaults.urgent[r.group_id] = Number(r.limit_hours);
          else defaults.normal[r.group_id] = Number(r.limit_hours);
        });
        setSla(defaults);
        const current = c.cycles?.find((x) => x.id === c.default_cycle_id);
        if (current) {
          setStartGroup(current.start_group_id || 1);
          setEndGroup(current.end_group_id || 4);
          setStartStatus(current.start_status_id || '');
          setEndStatus(current.end_status_id || '');
        }
      })
      .catch(console.error);
  }, [projectId]);

  const statusesByGroup = useMemo(() => (gid) => statuses.filter((s) => s.group_id === Number(gid)), [statuses]);

  useEffect(() => {
    if (slaNormal && slaUrgent) {
      setSla({ normal: { ...slaNormal }, urgent: { ...slaUrgent } });
    }
  }, [slaNormal, slaUrgent]);

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
    const res = await saveSettingsSLA(projectId, rules);
    const normal = { ...sla.normal };
    const urgent = { ...sla.urgent };
    res.rules.forEach((r) => {
      if (r.is_urgent) urgent[r.group_id] = Number(r.limit_hours);
      else normal[r.group_id] = Number(r.limit_hours);
    });
    setSla({ normal, urgent });
    onSlaSaved(normal, urgent);
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

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
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
      </Grid>

      <Grid item xs={12} md={6}>
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
            <Stack direction="row" spacing={2}>
              <Button variant="contained" onClick={handleSaveSLA}>Зберегти SLA</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Зберігає ліміти для звичайних замовлень; термінові можна додати окремо при потребі.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
