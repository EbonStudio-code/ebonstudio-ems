import { pool } from '../../core/database.js';

async function findUserByEmail(emailCanonical, db = pool) {
  const sql = `
    SELECT id, email_canonical, role, status, version, password_hash, session_version, ceo_display_name
    FROM public.users
    WHERE email_canonical = $1
  `;

  const values = [emailCanonical];
  const result = await db.query(sql, values);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export { findUserByEmail };