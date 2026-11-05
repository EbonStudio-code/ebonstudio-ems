import { Router } from 'express';
import { verify } from '@node-rs/argon2';
import { z, object, email, password, text, parse, send } from '../../core/validation.js';
import { self } from '../employees/service.js';
import { transaction, audit } from '../../core/transactions.js';
import { fail } from '../../core/errors.js';
import { authenticated, rateLimit, newSession, setSessionCookie, digest, secret, cookieOptions } from './session.js';
import { checkCredentials, issueToken, deliverToken, redeem, revokeSessions, hashPassword } from './service.js';
import { findUserByEmail } from './user.repository.js';

export function identityRoutes({ pool, config, mailer }) {
  const router = Router();
  const limited = (name, limit) => async (req, res, next) => {
    await rateLimit(pool, config, req, res, name, limit, 900);
    next();
  };
  router.get('/csrf', limited('csrf', 60), async (req, res) => {
    let csrf;
    if (req.session) {
      csrf = secret();
      await pool.query('UPDATE sessions SET csrf_hash=$2 WHERE token_hash=$1', [req.session.token_hash, digest(csrf)]);
    } else {
      const session = await newSession(pool, config);
      setSessionCookie(res, config, session);
      csrf = session.csrf;
    }
    send(res, { csrfToken: csrf });
  });
  router.post('/login', limited('login-ip', 30), async (req, res) => {
    const data = parse(object({ email, password: z.string().min(1).max(128) }), req.body);
    await rateLimit(pool, config, req, res, 'login-account', 10, 900, data.email);
    const credentials = await checkCredentials(pool, data.email, data.password);
    const session = await transaction(pool, async db => {
      const user = await findUserByEmail(data.email, db);
      if (user.status !== 'ACTIVE' || user.password_hash !== credentials.password_hash || user.session_version !== credentials.session_version) {
        fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
      }
      const created = await newSession(db, config, user, req.session.token_hash);
      await db.query('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
      await audit(db, { id: user.id, requestId: req.requestId }, 'identity', 'LOGIN', user.id);
      return created;
    });
    setSessionCookie(res, config, session);
    send(res, { csrfToken: session.csrf, expiresAt: session.expires_at });
  });
  router.get('/session', authenticated, async (req, res) => {
    const profile = req.actor.role === 'EMPLOYEE' ? await self(pool, req.actor) : null;
    send(res, { userId: req.actor.id, role: req.actor.role, email: req.actor.email,
      displayName: profile?.full_name || req.actor.displayName, employee: profile,
      enabledModules: ['identity', 'company', 'employees', ...config.modules],
      expiresAt: req.session.expires_at, absoluteExpiresAt: req.session.absolute_expires_at });
  });
  router.post('/logout', authenticated, async (req, res) => {
    parse(object({}), req.body);
    await pool.query('DELETE FROM sessions WHERE token_hash=$1', [req.session.token_hash]);
    res.clearCookie(config.cookieName, { ...cookieOptions(config), maxAge: undefined });
    res.status(204).end();
  });
  router.post('/forgot-password', limited('recovery-ip', 10), async (req, res) => {
    const data = parse(object({ email }), req.body);
    await rateLimit(pool, config, req, res, 'recovery-account', 4, 3600, data.email);
    const delivery = await transaction(pool, async db => {
      const user = await findUserByEmail(data.email, db);
      if (!user || user.status !== 'ACTIVE') return null;
      await audit(db, { requestId: req.requestId }, 'identity', 'PASSWORD_RECOVERY_REQUESTED', user.id);
      return issueToken(db, user, 'PASSWORD_RESET', config);
    });
    // Return before provider I/O so public response latency cannot reveal SMTP delivery.
    send(res, { message: 'If an eligible account exists, recovery instructions will be sent.' });
    if (delivery) {
      try { await deliverToken(pool, config, mailer, delivery); } catch { /* No token/provider details in request errors. */ }
    }
  });
  for (const [path, purpose] of [['accept-invitation', 'INVITATION'], ['reset-password', 'PASSWORD_RESET']]) {
    router.post('/' + path, limited('token-redemption', 15), async (req, res) => {
      const data = parse(object({ token: text(100), newPassword: password }), req.body);
      await redeem(pool, data.token, purpose, data.newPassword, { requestId: req.requestId });
      // The anonymous setup session is discarded too; no automatic sign-in.
      await pool.query('DELETE FROM sessions WHERE token_hash=$1', [req.session.token_hash]);
      res.clearCookie(config.cookieName, { ...cookieOptions(config), maxAge: undefined });
      send(res, { message: 'Password saved. Sign in to continue.' });
    });
  }
  router.post('/change-password', authenticated, limited('password-change', 10), async (req, res) => {
    const data = parse(object({ currentPassword: z.string().min(1).max(128), newPassword: password }), req.body);
    const current = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.actor.id]);
    if (!await verify(current.rows[0].password_hash, data.currentPassword)) fail(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    const passwordHash = await hashPassword(data.newPassword);
    const session = await transaction(pool, async db => {
      const row = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.actor.id]);
      if (row.rows[0].password_hash !== current.rows[0].password_hash) fail(409, 'VERSION_CONFLICT', 'Account changed. Sign in again.');
      await revokeSessions(db, req.actor.id);
      const result = await db.query('UPDATE users SET password_hash=$2 WHERE id=$1 RETURNING id,session_version', [req.actor.id, passwordHash]);
      await db.query('UPDATE account_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL', [req.actor.id]);
      await audit(db, req.actor, 'identity', 'PASSWORD_CHANGED', req.actor.id);
      return newSession(db, config, result.rows[0]);
    }, req.actor);
    setSessionCookie(res, config, session);
    send(res, { csrfToken: session.csrf, expiresAt: session.expires_at });
  });
  return router;
}
