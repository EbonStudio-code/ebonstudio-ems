export class MailDeliveryError extends Error {
  constructor(code, retryable = false, retryAfter = 0) {
    super('Email provider request failed');
    this.code = code;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
  }
}

export function emailContent({ purpose, url }) {
  const subjects = {
    INVITATION: 'Set up your employee account',
    PASSWORD_RESET: 'Reset your password',
    TASK_UPDATED: 'An assigned task has changed',
    LEAVE_UPDATED: 'A leave request has changed',
    COMPLAINT_UPDATED: 'A private HR conversation has changed',
    SALARY_UPDATED: 'A salary statement has changed',
  };
  const subject = subjects[purpose];
  if (!subject) throw new MailDeliveryError('MAIL_TEMPLATE');
  const account = ['INVITATION', 'PASSWORD_RESET'].includes(purpose);
  return {
    subject,
    text: account
      ? `Use this single-use link:\n${url}\nIf you did not expect this message, contact your company administrator.`
      : `Sign in to your employee workspace to review the update:\n${url}\nFor your privacy, details are only available after signing in.`,
  };
}

// Official Resend REST API. There is deliberately no configurable provider URL.
export function createResendMailer(config, { fetchImpl = fetch } = {}) {
  return {
    async send(message) {
      if (!message.idempotencyKey) throw new MailDeliveryError('MAIL_IDEMPOTENCY_REQUIRED');
      let response;
      try {
        response = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
          headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': message.idempotencyKey,
          },
          body: JSON.stringify({ from: message.from || config.mailFrom, to: [message.email], ...emailContent(message) }),
        });
      } catch {
        throw new MailDeliveryError('MAIL_NETWORK', true);
      }
      if (!response.ok) {
        // Never retain/log provider response bodies: they may echo recipient or token.
        await response.body?.cancel();
        const seconds = Number(response.headers.get('retry-after'));
        const retryAfter = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) : 0;
        throw new MailDeliveryError(`MAIL_HTTP_${response.status}`,
          [408, 425, 429].includes(response.status) || response.status >= 500, retryAfter);
      }
      let data;
      try { data = await response.json(); } catch { throw new MailDeliveryError('MAIL_RESPONSE', true); }
      if (typeof data.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.id)) throw new MailDeliveryError('MAIL_RESPONSE', true);
      return { id: data.id }; // Accepted by provider, not proof of inbox delivery.
    },
  };
}
