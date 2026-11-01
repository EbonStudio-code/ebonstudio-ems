import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { fail } from '../../core/errors.js';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
function cookieValue(req, name) {
  const values = (req.headers.cookie || '').split(';').map(s => s.trim()).filter(s => s.startsWith(name + '='));
  if (values.length !== 1) return null;
  const value = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export function cookieOptions(config) {
  return { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 };
}
export async function newSession(db, config, user = null, oldHash = null) {
  if (oldHash) await db.query('DELETE FROM sessions WHERE token_hash=$1', [oldHash]);
  const token = secret();
  const csrf = secret();
  const result = await db.query(`INSERT INTO sessions(token_hash,csrf_hash,user_id,session_version,expires_at,absolute_expires_at)
    VALUES($1,$2,$3,$4,now()+interval '30 minutes',now()+interval '8 hours') RETURNING expires_at,absolute_expires_at`,
  [digest(token), digest(csrf), user?.id || null, user?.session_version ?? null]);
  return { token, csrf, ...result.rows[0] };
}
export function setSessionCookie(res, config, session) {
  res.cookie(config.cookieName, session.token, cookieOptions(config));
}
export function sessionMiddleware(pool, config) {
  return async (req, res, next) => {
    const token = cookieValue(req, config.cookieName);
    if (token) {
      const hash = digest(token);
      const result = await pool.query(`SELECT s.*, u.role,u.status,u.email_canonical,u.ceo_display_name,
          u.session_version AS current_version
        FROM sessions s LEFT JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at>now() AND s.absolute_expires_at>now()`, [hash]);
      const session = result.rows[0];
      if (session && (!session.user_id || (session.status === 'ACTIVE' && session.session_version === session.current_version))) {
        req.session = session;
        if (session.user_id) {
          req.actor = { id: session.user_id, role: session.role, email: session.email_canonical,
            displayName: session.ceo_display_name, sessionHash: hash, requestId: req.requestId };
        }
        const refreshed = await pool.query("UPDATE sessions SET expires_at=LEAST(now()+interval '30 minutes',absolute_expires_at) WHERE token_hash=$1 RETURNING expires_at", [hash]);
        if (refreshed.rowCount) req.session.expires_at = refreshed.rows[0].expires_at;
      }
    }
    next();
  };
}
export function csrfCheck(config) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('Origin') !== config.origin) fail(403, 'CSRF_FAILED', 'Request origin is not allowed');
    const token = req.get('X-CSRF-Token');
    if (!req.session || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) fail(403, 'CSRF_FAILED', 'Refresh the CSRF token before retrying');
    const provided = Buffer.from(digest(token), 'hex');
    const expected = Buffer.from(req.session.csrf_hash, 'hex');
    if (expected.length !== provided.length || !timingSafeEqual(provided, expected)) fail(403, 'CSRF_FAILED', 'Invalid CSRF token');
    next();
  };
}
export function authenticated(req, res, next) {
  if (!req.actor) fail(401, 'NOT_AUTHENTICATED', 'Sign in to continue');
  next();
}
export function role(required) {
  return (req, res, next) => {
    authenticated(req, res, () => {});
    if (req.actor.role !== required) fail(403, 'FORBIDDEN', 'This action is not allowed for your role');
    next();
  };
}
export async function rateLimit(pool, config, req, res, namespace, limit, seconds, identity = req.ip) {
  const key = createHmac('sha256', config.rateLimitSecret).update(namespace + ':' + identity).digest('hex');
  const result = await pool.query(`INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<=now() THEN 1 ELSE rate_limits.count+1 END,
      expires_at=CASE WHEN rate_limits.expires_at<=now() THEN now()+$2*interval '1 second' ELSE rate_limits.expires_at END
    RETURNING count, GREATEST(1,ceil(extract(epoch FROM expires_at-now())))::int AS retry_after`, [key, seconds]);
  if (result.rows[0].count > limit * (config.testRateScale || 1)) {
    res.set('Retry-After', String(result.rows[0].retry_after));
    fail(429, 'RATE_LIMITED', 'Too many requests. Try again later.');
  }
}
