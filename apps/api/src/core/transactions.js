import { fail } from './errors.js';
import { queueHrEmail } from '../modules/identity/outbox.js';

// One company: serialize domain writes across API processes. Reads remain concurrent.
// This deliberately favors correctness; measure before replacing it with finer locks.
export async function transaction(pool, work, actor) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '10s'");
    await db.query("SET LOCAL statement_timeout = '15s'");
    await db.query('SELECT pg_advisory_xact_lock(74182, 1)');
    if (actor) {
      const result = await db.query(`SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id
        WHERE u.id=$1 AND s.token_hash=$2 AND u.status='ACTIVE'
        AND s.session_version=u.session_version AND s.expires_at>now() AND s.absolute_expires_at>now()`,
      [actor.id, actor.sessionHash]);
      if (!result.rowCount) fail(401, 'NOT_AUTHENTICATED', 'Sign in again');
    }
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
export async function audit(db, actor, module, action, entityId, reason = null) {
  const result = await db.query(`INSERT INTO audit_events(actor_user_id,module,action,entity_id,request_id,reason)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [actor.id || null, module, action, entityId, actor.requestId, reason]);
  await queueHrEmail(db, actor, action, entityId, result.rows[0].id);
}
