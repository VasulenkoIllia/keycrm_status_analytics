import bcrypt from 'bcrypt';

export async function findUserByLogin(db, login) {
  const res = await db.query('SELECT id, login, password_hash, role, is_active FROM users WHERE login = $1', [login]);
  return res.rows[0] || null;
}

export async function createUser(db, { login, password, role = 'user', is_active = true }) {
  const hash = await bcrypt.hash(password, 10);
  const res = await db.query(
    `INSERT INTO users (login, password_hash, role, is_active)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (login) DO NOTHING
     RETURNING id, login, role, is_active`,
    [login, hash, role, is_active]
  );
  return res.rows[0] || null;
}

export async function seedSuperAdmin(db, logger) {
  const login = process.env.SEED_SUPERADMIN_LOGIN || 'admin';
  const pass = process.env.SEED_SUPERADMIN_PASS || 'admin';
  const existing = await findUserByLogin(db, login);
  if (existing) return existing;
  const hash = await bcrypt.hash(pass, 10);
  const res = await db.query(
    `INSERT INTO users (login, password_hash, role, is_active)
     VALUES ($1,$2,'super_admin', true)
     RETURNING id, login, role, is_active`,
    [login, hash]
  );
  logger?.info?.(`Seeded super_admin user ${login}`);
  return res.rows[0];
}
