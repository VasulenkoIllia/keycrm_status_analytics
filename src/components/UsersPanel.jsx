import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Divider
} from '@mui/material';
import {
  fetchUsers,
  createUser,
  updateUser,
  updateUserPassword,
  fetchUserProjects,
  updateUserProjects
} from '../api/client';

const roleLabel = {
  super_admin: 'Супер-адмін',
  admin: 'Адмін',
  user: 'Користувач'
};

export default function UsersPanel({ projects = [], currentRole }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ login: '', password: '', role: 'user', is_active: true });
  const [projMap, setProjMap] = useState({});
  const [editingProjects, setEditingProjects] = useState(null);

  const load = () => {
    setLoading(true);
    fetchUsers()
      .then(setUsers)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const allowedRoles = currentRole === 'super_admin' ? ['super_admin', 'admin', 'user'] : ['admin', 'user'];

  const handleCreate = async () => {
    if (!newUser.login || !newUser.password) return alert('Заповніть логін і пароль');
    if (newUser.password.length < 6) return alert('Мінімум 6 символів у паролі');
    if (!allowedRoles.includes(newUser.role)) return alert('Немає прав створити таку роль');
    setCreating(true);
    try {
      await createUser(newUser);
      setNewUser({ login: '', password: '', role: 'user', is_active: true });
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateRole = async (user, payload) => {
    try {
      await updateUser(user.id, payload);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handlePassword = async (user) => {
    const pass = window.prompt(`Новий пароль для ${user.login} (мін. 6 символів)`);
    if (!pass) return;
    if (pass.length < 6) return alert('Мінімум 6 символів у паролі');
    try {
      await updateUserPassword(user.id, pass);
      alert('Пароль оновлено');
    } catch (e) {
      alert(e.message);
    }
  };

  const openProjects = async (user) => {
    setEditingProjects(user.id === editingProjects ? null : user.id);
    if (projMap[user.id]) return;
    try {
      const res = await fetchUserProjects(user.id);
      setProjMap((p) => ({ ...p, [user.id]: res.projects || [] }));
    } catch (e) {
      alert(e.message);
    }
  };

  const saveProjects = async (userId, list) => {
    try {
      await updateUserProjects(userId, list);
      setProjMap((p) => ({ ...p, [userId]: list }));
      alert('Доступи збережено');
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Створити користувача</Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <TextField
          label="Логін"
          size="small"
          value={newUser.login}
          onChange={(e) => setNewUser((p) => ({ ...p, login: e.target.value }))}
        />
        <TextField
          label="Пароль (мін. 6)"
          size="small"
          type="password"
          value={newUser.password}
          onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
        />
        <Select
          size="small"
          value={newUser.role}
          onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
        >
          {allowedRoles.map((r) => (
            <MenuItem key={r} value={r}>{roleLabel[r]}</MenuItem>
          ))}
        </Select>
        <FormControlLabel
          control={
            <Switch
              checked={newUser.is_active}
              onChange={(e) => setNewUser((p) => ({ ...p, is_active: e.target.checked }))}
            />
          }
          label="Активний"
        />
        <Button variant="contained" onClick={handleCreate} disabled={creating}>
          Створити
        </Button>
      </Stack>

      <Divider />

      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle1">Користувачі</Typography>
          {loading && <Chip label="Завантаження..." size="small" />}
        </Stack>
        {users.map((u) => {
          const disableSuper = u.role === 'super_admin' && currentRole !== 'super_admin';
          const roleOptions = Array.from(new Set([...allowedRoles, u.role]));
          const projectsForUser = projMap[u.id] || [];
          return (
            <Card key={u.id} variant="outlined">
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="subtitle1" sx={{ minWidth: 120 }}>{u.login}</Typography>
                      <Chip label={roleLabel[u.role] || u.role} color={u.role === 'super_admin' ? 'warning' : 'default'} />
                      {!u.is_active && <Chip label="Деактивований" color="error" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      ID: {u.id}
                    </Typography>
                  </Stack>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <Select
                      size="small"
                      value={u.role}
                      disabled={disableSuper}
                      onChange={(e) => handleUpdateRole(u, { role: e.target.value })}
                    >
                      {roleOptions.map((r) => (
                        <MenuItem key={r} value={r} disabled={r === 'super_admin' && currentRole !== 'super_admin'}>
                          {roleLabel[r] || r}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={u.is_active}
                          disabled={disableSuper}
                          onChange={(e) => handleUpdateRole(u, { is_active: e.target.checked })}
                        />
                      }
                      label="Активний"
                    />
                    <Button size="small" variant="outlined" onClick={() => handlePassword(u)} disabled={disableSuper}>
                      Змінити пароль
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => openProjects(u)} disabled={disableSuper}>
                      Проєкти
                    </Button>
                  </Stack>
                  {editingProjects === u.id && (
                    <Stack spacing={1}>
                      <Select
                        multiple
                        size="small"
                        value={projectsForUser}
                        onChange={(e) => {
                          const vals = e.target.value.map(Number);
                          setProjMap((p) => ({ ...p, [u.id]: vals }));
                        }}
                      >
                        {projects.map((p) => (
                          <MenuItem key={p.id} value={p.id}>
                            {p.name}
                          </MenuItem>
                        ))}
                      </Select>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => saveProjects(u.id, projectsForUser)}
                        >
                          Зберегти доступи
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => setEditingProjects(null)}
                        >
                          Закрити
                        </Button>
                      </Stack>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
