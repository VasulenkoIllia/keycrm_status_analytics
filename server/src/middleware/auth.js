import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { findUserByLogin } from '../db/users.js';

const DEFAULT_SECRET = 'dev_secret';
const SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

export function issueToken(user) {
  return jwt.sign({ sub: user.id, login: user.login, role: user.role }, SECRET, { expiresIn: '8h' });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export function loginHandler(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(401).json({ error: 'unauthorized' });
  const db = req.app.get('db');
  findUserByLogin(db, username)
    .then(async (u) => {
      if (!u || !u.is_active) return res.status(401).json({ error: 'unauthorized' });
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) return res.status(401).json({ error: 'unauthorized' });
      const token = issueToken(u);
      return res.json({ token, role: u.role, login: u.login });
    })
    .catch(() => res.status(500).json({ error: 'internal' }));
}

export function apiAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) return res.status(403).json({ error: 'forbidden' });
    return next();
  };
}

export function webhookAuth(req, res, next) {
  const envToken = process.env.WEBHOOK_TOKEN;
  const allowEmpty = process.env.ALLOW_EMPTY_WEBHOOK_TOKEN === 'true';
  const queryToken = req.query.token;
  const header = req.headers['x-webhook-token'] || '';
  const provided = queryToken || header;

  // 1) якщо є env токен і він співпав — пропускаємо одразу
  if (envToken && provided === envToken) return next();

  // 2) перевіряємо проектний токен (пріоритетний, навіть якщо envToken заданий)
  const projectId = Number(req.query.project || req.body?.project);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project is required' });
  if (!provided && !allowEmpty) return res.status(401).json({ error: 'webhook token required' });

  const db = req.app.get('db');
  db.query('SELECT webhook_token FROM projects WHERE id = $1', [projectId])
    .then((r) => {
      if (!r.rows[0]) return res.status(404).json({ error: 'project not found' });
      const projToken = r.rows[0].webhook_token || null;
      if (!projToken && allowEmpty) return next();
      if (!projToken) return res.status(401).json({ error: 'webhook token required' });
      if (provided && provided === projToken) return next();
      // якщо є envToken і збігся б — вже вийшли вище, тож тут 401
      return res.status(401).json({ error: 'unauthorized' });
    })
    .catch(() => res.status(500).json({ error: 'internal' }));
}
