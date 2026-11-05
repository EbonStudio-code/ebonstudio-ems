import pg from 'pg';
import { pathToFileURL } from 'node:url';

export async function grantRuntime(db, role) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(role)) throw new Error('RUNTIME_ROLE must be a simple lowercase PostgreSQL role name');
  const who = '"' + role + '"';
  const identity = await db.query('SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1', [role]);
  const row = identity.rows[0];
  if (!row || row.rolsuper || row.rolcreatedb || row.rolcreaterole || row.rolreplication || row.rolbypassrls) throw new Error('Use an existing nonprivileged runtime login role');
  await db.query('GRANT USAGE ON SCHEMA public TO ' + who);
  await db.query('GRANT SELECT ON schema_migrations TO ' + who);
  await db.query(`GRANT SELECT,INSERT,UPDATE ON users,company_settings,employees,sessions,account_tokens,rate_limits,holidays,
    attendance,leave_requests,leave_reservations,tasks,complaints,salary_slips TO ${who}`);
  await db.query(`GRANT SELECT,INSERT ON audit_events,attendance_corrections,leave_history,complaint_messages TO ${who}`);
  await db.query(`GRANT DELETE ON sessions,account_tokens,rate_limits,holidays,leave_reservations TO ${who}`);
  await db.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON email_outbox TO ${who}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = new pg.Pool({ connectionTimeoutMillis: 5000 });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await grantRuntime(db, process.env.RUNTIME_ROLE || 'ems_app');
    await db.query('COMMIT');
    console.log('Runtime table grants applied. No role elevation or password change was performed.');
  } catch {
    await db.query('ROLLBACK');
    console.error('Grant failed. Check owner access and the existing runtime role attributes.');
    process.exitCode = 1;
  } finally {
    db.release();
    await pool.end();
  }
}
