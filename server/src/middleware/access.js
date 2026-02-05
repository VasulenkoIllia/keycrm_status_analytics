// Access control helpers built on top of apiAuth

export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) return res.status(403).json({ error: 'forbidden' });
    return next();
  };
}

export function requireProjectAccess() {
  return async (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    if (user.role === 'super_admin') return next();

    const projectId = Number(
      req.query.project_id ||
        req.body?.project_id ||
        req.params?.project_id ||
        req.query.project ||
        req.body?.project
    );
    if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'project_id required' });

    const db = req.app.get('db');
    const check = await db.query(
      'SELECT 1 FROM user_projects WHERE user_id = $1 AND project_id = $2 LIMIT 1',
      [user.sub, projectId]
    );
    if (check.rows.length === 0 && user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });

    return next();
  };
}
