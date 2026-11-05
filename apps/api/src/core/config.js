const optionalModules = ['holidays', 'attendance', 'leave', 'tasks', 'complaints', 'salary-slips'];
export function loadConfig(env = process.env) {
  if (env.NODE_ENV && !['development','test','production'].includes(env.NODE_ENV)) throw new Error('Invalid NODE_ENV');
  const production = env.NODE_ENV === 'production';
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 2) throw new Error('TRUST_PROXY_HOPS must be 0, 1, or 2');
  const origin = env.APP_ORIGIN || 'http://127.0.0.1:5173';
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error('APP_ORIGIN must be an origin');
  if (production && url.protocol !== 'https:') throw new Error('Production requires HTTPS APP_ORIGIN');
  const modules = env.ENABLED_MODULES === undefined ? optionalModules : env.ENABLED_MODULES.split(',').filter(Boolean);
  if (new Set(modules).size !== modules.length || modules.some(m => !optionalModules.includes(m))) throw new Error('Invalid ENABLED_MODULES');
  if (modules.some(m => ['attendance', 'leave'].includes(m)) && !modules.includes('holidays')) throw new Error('Attendance/leave require holidays');
  const mailMode = env.MAIL_MODE || 'disabled';
  if (!['disabled', 'preview', 'smtp', 'resend'].includes(mailMode)) throw new Error('Invalid MAIL_MODE');
  if (production && !['smtp', 'resend'].includes(mailMode)) throw new Error('Production requires configured email delivery');
  if (mailMode === 'resend') {
    if (!env.RESEND_API_KEY || !/^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY)) throw new Error('RESEND_API_KEY is required');
    if (!/^[a-f0-9]{64}$/i.test(env.MAIL_OUTBOX_KEY || '')) throw new Error('MAIL_OUTBOX_KEY must be 32 random bytes encoded as hex');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(env.MAIL_FROM_DOMAIN || '')) throw new Error('MAIL_FROM_DOMAIN is required');
    const sender = /^[^<>\r\n]+<([^<>\s@]+@([^<>\s@]+))>$/.exec(env.MAIL_FROM || '');
    if (!sender || sender[2].toLowerCase() !== env.MAIL_FROM_DOMAIN.toLowerCase()) throw new Error('MAIL_FROM must use the verified MAIL_FROM_DOMAIN');
    if (production && env.MAIL_FROM_DOMAIN === 'resend.dev') throw new Error('Use your own verified sending domain');
  }
  if (env.HR_NOTIFICATIONS_ENABLED && !['true', 'false'].includes(env.HR_NOTIFICATIONS_ENABLED)) throw new Error('Invalid HR_NOTIFICATIONS_ENABLED');
  if (production && (!env.RATE_LIMIT_SECRET || env.RATE_LIMIT_SECRET.length < 32)) throw new Error('RATE_LIMIT_SECRET must be at least 32 characters');
  if (production && (!env.READINESS_SECRET || env.READINESS_SECRET.length < 32)) throw new Error('READINESS_SECRET must be at least 32 characters');
  return {
    port, host: env.HOST || '127.0.0.1', origin, production, modules, trustProxyHops,
    cookieName: production ? '__Host-ems' : 'ems.sid',
    rateLimitSecret: env.RATE_LIMIT_SECRET || 'local-development-only-stable-rate-limit-key',
    mailMode, mailDir: env.MAIL_PREVIEW_DIR || '.local-mail',
    smtpHost: env.SMTP_HOST, smtpPort: Number(env.SMTP_PORT || 587),
    smtpUser: env.SMTP_USER, smtpPassword: env.SMTP_PASSWORD,
    smtpSecure: env.SMTP_SECURE === 'true', mailFrom: env.MAIL_FROM,
    resendApiKey: env.RESEND_API_KEY, mailOutboxKey: env.MAIL_OUTBOX_KEY,
    hrNotifications: env.HR_NOTIFICATIONS_ENABLED === 'true',
    pdfFont: env.PDF_FONT_PATH, readinessSecret: env.READINESS_SECRET,
  };
}
