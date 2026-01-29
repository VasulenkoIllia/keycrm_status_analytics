export async function getProject(db, projectId) {
  const res = await db.query('SELECT * FROM projects WHERE id = $1 AND is_active = TRUE', [projectId]);
  if (res.rows.length === 0) throw new Error(`project ${projectId} not found or inactive`);
  return res.rows[0];
}
