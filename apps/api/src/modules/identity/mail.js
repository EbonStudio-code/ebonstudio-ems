import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const executeFile = promisify(execFile);

export function createMailer(config) {
  if (config.mailMode === 'disabled') return { send: async () => { throw new Error('Delivery is disabled'); } };
  if (config.mailMode === 'preview') {
    if (config.production) throw new Error('Preview delivery is forbidden in production');
    return {
      async send(message) {
        const dir = resolve(config.mailDir);
        await mkdir(dir, { recursive: true, mode: 0o700 });
        if (process.platform === 'win32') {
          const account = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
          await executeFile(join(process.env.SystemRoot, 'System32', 'icacls.exe'),
            [dir, '/inheritance:r', '/grant:r', `${account}:(OI)(CI)F`], { windowsHide: true, timeout: 10000 });
        }
        await writeFile(join(dir, `${randomUUID()}.json`), JSON.stringify(message, null, 2), { flag: 'wx', mode: 0o600 });
      },
    };
  }
  if (!config.smtpHost || !config.mailFrom || !Number.isInteger(config.smtpPort)) throw new Error('SMTP configuration is incomplete');
  const transport = nodemailer.createTransport({
    host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure,
    requireTLS: !config.smtpSecure,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
    disableFileAccess: true, disableUrlAccess: true,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  return {
    async send({ email, purpose, url }) {
      await transport.sendMail({
        from: config.mailFrom, to: { address: email, name: '' },
        subject: purpose === 'INVITATION' ? 'Set up your employee account' : 'Reset your password',
        text: `Use this single-use link:\n${url}\nIf you did not expect this message, contact your company administrator.`,
      });
    },
  };
}
