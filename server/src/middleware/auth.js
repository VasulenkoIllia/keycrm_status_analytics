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
  const token = process.env.WEBHOOK_TOKEN;
  if (!token) return next();
  const queryToken = req.query.token;
  const header = req.headers['x-webhook-token'] || '';
  if ((queryToken && queryToken === token) || (header && header === token)) return next();
  return res.status(401).json({ error: 'unauthorized' });
}
