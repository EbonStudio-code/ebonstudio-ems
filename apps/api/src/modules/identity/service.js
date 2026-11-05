import { hash, verify } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import { digest, secret } from './session.js';
import { findUserByEmail } from './user.repository.js';
import { fail } from '../../core/errors.js';
import { transaction, audit } from '../../core/transactions.js';
import { queueAccountEmail } from './outbox.js';

export const hashPassword = value => hash(value, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
const dummyHash = await hashPassword(secret());
export async function checkCredentials(db, email, password) {
  const user = await findUserByEmail(email, db);
  const valid = await verify(user?.password_hash || dummyHash, password);
  if (!valid || !user || user.status !== 'ACTIVE') fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  return user;
}
export async function revokeSessions(db, userId) {
  await db.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
  await db.query('UPDATE users SET session_version=session_version+1,updated_at=now(),version=version+1 WHERE id=$1', [userId]);
}
export async function issueToken(db, user, purpose, config) {
  await db.query('UPDATE account_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL', [user.id]);
  const token = secret();
  const hours = purpose === 'INVITATION' ? 24 : 0.5;
  const result = await db.query(`INSERT INTO account_tokens(user_id,purpose,token_hash,expires_at)
    VALUES($1,$2,$3,now()+$4*interval '1 hour') RETURNING id,expires_at`, [user.id, purpose, digest(token), hours]);
  if (purpose === 'INVITATION') await db.query('UPDATE users SET invited_at=now(),updated_at=now() WHERE id=$1', [user.id]);
  const delivery = { ...result.rows[0], email: user.email_canonical, purpose, token };
  if (config?.mailMode === 'resend') {
    await queueAccountEmail(db, config, user.id, delivery);
    delivery.queued = true;
  }
  return delivery;
}
export async function deliverToken(pool, config, mailer, delivery) {
  if (delivery.queued) return 'pending';
  let status = 'sent';
  try {
    const route = delivery.purpose === 'INVITATION' ? '/accept-invitation' : '/reset-password';
    await mailer.send({ email: delivery.email, purpose: delivery.purpose, url: `${config.origin}${route}#token=${delivery.token}` });
  } catch {
    status = 'failed';
  }
  await pool.query('UPDATE account_tokens SET delivery_status=$2 WHERE id=$1', [delivery.id, status]);
  return status;
}
export async function reinvite(db, userId, config) {
  await revokeSessions(db, userId);
  const result = await db.query(`UPDATE users SET status='INVITED',password_hash=NULL,updated_at=now()
    WHERE id=$1 RETURNING id,email_canonical`, [userId]);
  return issueToken(db, result.rows[0], 'INVITATION', config);
}
export async function redeem(pool, token, purpose, newPassword, actor) {
  // Perform expensive hashing outside the write lock; the token is rechecked inside.
  const passwordHash = await hashPassword(newPassword);
  await transaction(pool, async db => {
    const result = await db.query(`SELECT t.id,t.user_id,u.status FROM account_tokens t JOIN users u ON u.id=t.user_id
      WHERE t.token_hash=$1 AND t.purpose=$2 AND t.consumed_at IS NULL AND t.expires_at>now()`, [digest(token), purpose]);
    const item = result.rows[0];
    const expected = purpose === 'INVITATION' ? 'INVITED' : 'ACTIVE';
    if (!item || item.status !== expected) fail(422, 'INVALID_TOKEN', 'This link is invalid or expired');
    await db.query(`UPDATE users SET password_hash=$2,status='ACTIVE',activated_at=COALESCE(activated_at,now()),updated_at=now()
      WHERE id=$1`, [item.user_id, passwordHash]);
    await db.query('UPDATE account_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL', [item.user_id]);
    await revokeSessions(db, item.user_id);
    await audit(db, { ...actor, id: item.user_id }, 'identity', purpose === 'INVITATION' ? 'ACCOUNT_ACTIVATED' : 'PASSWORD_RESET', item.user_id);
  });
}
export async function bootstrapCeo(pool, displayName, email, actor = { requestId: randomUUID() }, config) {
  return transaction(pool, async db => {
    const existing = await db.query("SELECT id FROM users WHERE role='CEO'");
    if (existing.rowCount) fail(409, 'CEO_EXISTS', 'CEO already exists. Use the recovery process.');
    const result = await db.query(`INSERT INTO users(email_canonical,role,ceo_display_name)
      VALUES($1,'CEO',$2) RETURNING id,email_canonical`, [email, displayName]);
    await audit(db, actor, 'identity', 'CEO_BOOTSTRAPPED', result.rows[0].id);
    return issueToken(db, result.rows[0], 'INVITATION', config);
  });
}
