import { pool } from '../src/core/database.js';
try {
  const sessions = await pool.query('DELETE FROM sessions WHERE expires_at<=now() OR absolute_expires_at<=now()');
  const limits = await pool.query('DELETE FROM rate_limits WHERE expires_at<=now()');
  const outbox = await pool.query("DELETE FROM email_outbox WHERE expires_at<now()-interval '7 days'");
  const tokens = await pool.query("DELETE FROM account_tokens WHERE expires_at<now()-interval '7 days'");
  console.log(JSON.stringify({ expiredSessions: sessions.rowCount, expiredRateLimits: limits.rowCount, expiredTokens: tokens.rowCount, expiredMail: outbox.rowCount }));
} finally {
  await pool.end();
}
