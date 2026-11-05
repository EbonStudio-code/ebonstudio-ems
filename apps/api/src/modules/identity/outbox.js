import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { MailDeliveryError } from './resend.js';

export function encryptMessage(message, key, id) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  cipher.setAAD(Buffer.from(id));
  const data = Buffer.concat([cipher.update(JSON.stringify(message), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(value => value.toString('base64url')).join('.');
}
export function decryptMessage(payload, key, id) {
  const [iv, tag, data] = payload.split('.').map(value => Buffer.from(value, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  cipher.setAAD(Buffer.from(id));
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8'));
}

export async function queueAccountEmail(db, config, userId, delivery) {
  const id = randomUUID();
  const route = delivery.purpose === 'INVITATION' ? '/accept-invitation' : '/reset-password';
  const payload = encryptMessage({
    email: delivery.email, from: config.mailFrom, purpose: delivery.purpose,
    url: `${config.origin}${route}#token=${delivery.token}`,
  }, config.mailOutboxKey, id);
  await db.query(`INSERT INTO email_outbox(id,user_id,account_token_id,kind,payload,expires_at)
    VALUES($1,$2,$3,$4,$5,LEAST($6::timestamptz-interval '30 seconds',now()+interval '23 hours'))`,
  [id, userId, delivery.id, delivery.purpose, payload, delivery.expires_at]);
}

export async function queueHrEmail(db, actor, action, entityId, auditId) {
  let kind, recipient;
  if (['TASK_CREATED', 'TASK_UPDATED'].includes(action)) {
    kind = 'TASK_UPDATED';
    recipient = await db.query('SELECT e.user_id FROM tasks t JOIN employees e ON e.id=t.assignee_employee_id WHERE t.id=$1', [entityId]);
  } else if (['LEAVE_SUBMITTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'LEAVE_CANCELLED'].includes(action)) {
    kind = 'LEAVE_UPDATED';
    recipient = await db.query(`SELECT CASE WHEN u.role='CEO' THEN e.user_id
      ELSE (SELECT id FROM users WHERE role='CEO') END AS user_id
      FROM leave_requests l JOIN employees e ON e.id=l.employee_id
      JOIN users u ON u.id=$2 WHERE l.id=$1`, [entityId, actor.id]);
  } else if (['COMPLAINT_CREATED', 'COMPLAINT_REPLY_ADDED', 'COMPLAINT_STATE_CHANGED'].includes(action)) {
    kind = 'COMPLAINT_UPDATED';
    recipient = await db.query(`SELECT CASE WHEN u.role='CEO' THEN e.user_id
      ELSE (SELECT id FROM users WHERE role='CEO') END AS user_id
      FROM complaints c JOIN employees e ON e.id=c.employee_id
      JOIN users u ON u.id=$2 WHERE c.id=$1`, [entityId, actor.id]);
  } else if (['SALARY_PUBLISHED', 'SALARY_VOIDED'].includes(action)) {
    kind = 'SALARY_UPDATED';
    recipient = await db.query('SELECT e.user_id FROM salary_slips s JOIN employees e ON e.id=s.employee_id WHERE s.id=$1', [entityId]);
  } else return;
  const userId = recipient.rows[0]?.user_id;
  if (!userId || userId === actor.id) return;
  // Only identifiers are persisted. No complaint, leave, salary or task text.
  await db.query(`INSERT INTO email_outbox(user_id,audit_event_id,kind,expires_at)
    SELECT id,$2,$3,now()+interval '23 hours' FROM users WHERE id=$1 AND status='ACTIVE'`,
  [userId, auditId, kind]);
}

export function retryDelay(attempt, retryAfter = 0, random = Math.random) {
  return Math.max(retryAfter, Math.min(3600, 30 * 2 ** (attempt - 1)) + Math.floor(random() * 10));
}

export async function processOutbox(pool, config, mailer, logger = () => {}) {
  const leaseId = randomUUID();
  const selected = await pool.query(`UPDATE email_outbox SET status='sending',lease_id=$1,
    lease_until=now()+interval '60 seconds',attempts=attempts+1,updated_at=now()
    WHERE id=(SELECT id FROM email_outbox
      WHERE (status='pending' AND next_attempt_at<=now()) OR (status='sending' AND lease_until<now())
      ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`, [leaseId]);
  const item = selected.rows[0];
  if (!item) return false;
  let status = 'accepted', code = null, providerId = null, delay = 0;
  try {
    if (new Date(item.expires_at).getTime() <= Date.now() || item.attempts > 8) throw new MailDeliveryError('MAIL_EXPIRED');
    const account = ['INVITATION', 'PASSWORD_RESET'].includes(item.kind);
    const user = (await pool.query('SELECT email_canonical,status,role FROM users WHERE id=$1', [item.user_id])).rows[0];
    const expected = item.kind === 'INVITATION' ? 'INVITED' : 'ACTIVE';
    if (!user || user.status !== expected) throw new MailDeliveryError('MAIL_CANCELLED');
    let message;
    if (account) {
      const token = (await pool.query('SELECT consumed_at,expires_at FROM account_tokens WHERE id=$1', [item.account_token_id])).rows[0];
      if (!token || token.consumed_at || new Date(token.expires_at).getTime() <= Date.now()) throw new MailDeliveryError('MAIL_CANCELLED');
      try { message = decryptMessage(item.payload, config.mailOutboxKey, item.id); }
      catch { throw new MailDeliveryError('MAIL_PAYLOAD'); }
      if (message.email !== user.email_canonical) throw new MailDeliveryError('MAIL_CANCELLED');
    } else {
      if (!config.hrNotifications) throw new MailDeliveryError('MAIL_CANCELLED');
      const paths = { TASK_UPDATED: '/tasks', LEAVE_UPDATED: '/leave', COMPLAINT_UPDATED: '/complaints', SALARY_UPDATED: '/salary-slips' };
      const base = user.role === 'CEO' ? '/ceo' : '/employee';
      if (item.payload) {
        try { message = decryptMessage(item.payload, config.mailOutboxKey, item.id); }
        catch { throw new MailDeliveryError('MAIL_PAYLOAD'); }
        if (message.email !== user.email_canonical) throw new MailDeliveryError('MAIL_CANCELLED');
      } else {
        message = { email: user.email_canonical, from: config.mailFrom, purpose: item.kind, url: config.origin + base + paths[item.kind] };
        const payload = encryptMessage(message, config.mailOutboxKey, item.id);
        await pool.query('UPDATE email_outbox SET payload=$3 WHERE id=$1 AND lease_id=$2', [item.id, leaseId, payload]);
      }
    }
    const result = await mailer.send({ ...message, idempotencyKey: `ems/${item.id}` });
    providerId = result?.id || null;
  } catch (error) {
    code = error instanceof MailDeliveryError ? error.code : 'MAIL_INTERNAL';
    status = code === 'MAIL_CANCELLED' ? 'cancelled' : 'failed';
    if (error instanceof MailDeliveryError && error.retryable && item.attempts < 8) {
      delay = retryDelay(item.attempts, error.retryAfter);
      if (Date.now() + delay * 1000 < new Date(item.expires_at).getTime()) status = 'pending';
    }
  }
  // One statement commits delivery metadata and the account-token status together.
  await pool.query(`WITH completed AS (
    UPDATE email_outbox SET status=$3,error_code=$4,provider_id=$5,
      payload=CASE WHEN $3='pending' THEN payload ELSE NULL END,
      next_attempt_at=now()+$6*interval '1 second',lease_id=NULL,lease_until=NULL,updated_at=now()
    WHERE id=$1 AND lease_id=$2 RETURNING account_token_id)
    UPDATE account_tokens SET delivery_status=CASE WHEN $3='accepted' THEN 'sent'
      WHEN $3='pending' THEN 'pending' ELSE 'failed' END
    WHERE id IN (SELECT account_token_id FROM completed)`, [item.id, leaseId, status, code, providerId, delay]);
  logger({ event: 'email_attempt', jobId: item.id, kind: item.kind, attempt: item.attempts, status, code });
  return true;
}
