import jwt from 'jsonwebtoken';

const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'admin123';
const DEFAULT_SECRET = 'dev_secret';

const creds = {
  user: process.env.AUTH_USER || DEFAULT_USER,
  pass: process.env.AUTH_PASS || DEFAULT_PASS,
  secret: process.env.JWT_SECRET || DEFAULT_SECRET
};

// У проді не стартуємо з дефолтними обліковими даними
if (process.env.NODE_ENV === 'production') {
  if (creds.user === DEFAULT_USER || creds.pass === DEFAULT_PASS || creds.secret === DEFAULT_SECRET) {
    throw new Error('AUTH_USER/AUTH_PASS/JWT_SECRET must be set in production');
  }
}

const getCreds = () => creds;

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
