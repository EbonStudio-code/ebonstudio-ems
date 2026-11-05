import { writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { pool } from '../src/core/database.js';
import { loadConfig } from '../src/core/config.js';
import { createMailer } from '../src/modules/identity/mail.js';
import { processOutbox } from '../src/modules/identity/outbox.js';
import { checkSchema } from '../src/core/schema.js';

const config = loadConfig();
if (config.mailMode !== 'resend') throw new Error('The outbox worker requires Resend');
const mailer = createMailer(config);
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
try {
  await checkSchema(pool);
  while (!stopping) {
    try {
      await processOutbox(pool, config, mailer, event => console.log(JSON.stringify(event)));
      await writeFile('/tmp/ems-mail-heartbeat', String(Date.now()), { mode: 0o600 });
    } catch {
      console.error(JSON.stringify({ event: 'email_worker_unavailable' }));
    }
    await setTimeout(1000); // Below the default Resend rate limit; one dedicated worker.
  }
} finally {
  await pool.end();
}
