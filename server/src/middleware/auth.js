import jwt from 'jsonwebtoken';

const getCreds = () => ({
  user: process.env.AUTH_USER || 'admin',
  pass: process.env.AUTH_PASS || 'admin123',
  secret: process.env.JWT_SECRET || 'dev_secret'
});

export function issueToken(username) {
  const { secret } = getCreds();
  return jwt.sign({ sub: username }, secret, { expiresIn: '8h' });
}

export function verifyToken(token) {
  const { secret } = getCreds();
  return jwt.verify(token, secret);
}

export function loginHandler(req, res) {
  const { user, pass } = getCreds();
  const { username, password } = req.body || {};
  if (username === user && password === pass) {
    const token = issueToken(username);
    return res.json({ token });
  }
  return res.status(401).json({ error: 'unauthorized' });
}

export function apiAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    verifyToken(token);
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

export function webhookAuth(req, res, next) {
  const envToken = process.env.WEBHOOK_TOKEN;
  const queryToken = req.query.token;
  const header = req.headers['x-webhook-token'] || '';
  const provided = queryToken || header;

  // 1) якщо є env токен і він співпав — пропускаємо одразу
  if (envToken && provided === envToken) return next();

  // 2) перевіряємо проектний токен (пріоритетний, навіть якщо envToken заданий)
  const projectId = Number(req.query.project || req.body?.project);
  if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project is required' });
  const db = req.app.get('db');
  db.query('SELECT webhook_token FROM projects WHERE id = $1', [projectId])
    .then((r) => {
      const projToken = r.rows[0]?.webhook_token || null;
      if (!projToken) {
        // якщо токен проєкту не заданий — допускаємо
        return next();
      }
      if (provided && provided === projToken) return next();
      // якщо є envToken і збігся б — вже вийшли вище, тож тут 401
      return res.status(401).json({ error: 'unauthorized' });
    })
    .catch(() => res.status(500).json({ error: 'internal' }));
}
