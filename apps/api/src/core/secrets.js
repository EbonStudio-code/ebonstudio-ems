import { readFileSync } from 'node:fs';

// Loaded before application imports by the container entrypoint. Never log values.
export function loadSecrets(env = process.env, read = readFileSync) {
  for (const name of ['PGPASSWORD', 'RATE_LIMIT_SECRET', 'READINESS_SECRET', 'RESEND_API_KEY', 'MAIL_OUTBOX_KEY', 'SMTP_PASSWORD']) {
    if (!env[`${name}_FILE`]) continue;
    if (env[name]) throw new Error(`Use either ${name} or ${name}_FILE, not both`);
    const value = read(env[`${name}_FILE`], 'utf8').trim();
    if (!value) throw new Error(`${name}_FILE is empty`);
    env[name] = value;
  }
}
loadSecrets();
