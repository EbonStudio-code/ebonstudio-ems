import { fail } from '../../core/errors.js';

export async function company(db) {
  const result = await db.query('SELECT * FROM company_settings WHERE id=true');
  if (!result.rowCount) fail(409, 'COMPANY_NOT_CONFIGURED', 'The CEO must configure company settings first');
  return result.rows[0];
}
export async function advanceCalendar(db, revision = false) {
  await db.query(`UPDATE company_settings SET calendar_guard=calendar_guard+1,
    calendar_revision=calendar_revision+$1 WHERE id=true`, [revision ? 1 : 0]);
}
export function companyPublic(row) {
  const { id, calendar_guard, ...safe } = row;
  return safe;
}
