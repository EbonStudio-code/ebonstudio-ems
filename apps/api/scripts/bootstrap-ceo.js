import { randomUUID } from 'node:crypto';
import { pool } from '../src/core/database.js';
import { loadConfig } from '../src/core/config.js';
import { parse, object, text, email } from '../src/core/validation.js';
import { createMailer } from '../src/modules/identity/mail.js';
import { bootstrapCeo, deliverToken, issueToken } from '../src/modules/identity/service.js';
import { transaction, audit } from '../src/core/transactions.js';

try {
  const config = loadConfig();
  if (config.mailMode === 'disabled') throw new Error('Choose preview or SMTP delivery explicitly before CEO bootstrap');
  const mailer = createMailer(config);
  let delivery;
  if (process.argv.includes('--resend')) {
    delivery = await transaction(pool, async db => {
      const result = await db.query("SELECT id,email_canonical FROM users WHERE role='CEO' AND status='INVITED'");
      if (result.rowCount !== 1) throw new Error('No invited CEO account exists. Active accounts use password recovery.');
      const actor = { requestId: randomUUID() };
      await audit(db, actor, 'identity', 'CEO_INVITATION_REISSUED', result.rows[0].id);
      return issueToken(db, result.rows[0], 'INVITATION');
    });
  } else {
    const data = parse(object({ displayName: text(), email }), { displayName: process.env.BOOTSTRAP_CEO_NAME, email: process.env.BOOTSTRAP_CEO_EMAIL });
    delivery = await bootstrapCeo(pool, data.displayName, data.email);
  }
  const status = await deliverToken(pool, config, mailer, delivery);
  console.log(`CEO setup delivery: ${status}. Tokens and account details are not printed.`);
  if (status === 'failed') process.exitCode = 1;
} catch {
  console.error('CEO bootstrap failed. Check configuration, schema, and whether a CEO already exists. No account was reset.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
