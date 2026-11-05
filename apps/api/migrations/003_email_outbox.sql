BEGIN;

CREATE TABLE email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  account_token_id UUID UNIQUE REFERENCES account_tokens(id) ON DELETE SET NULL,
  audit_event_id UUID UNIQUE REFERENCES audit_events(id),
  kind TEXT NOT NULL CHECK (kind IN ('INVITATION','PASSWORD_RESET','TASK_UPDATED','LEAVE_UPDATED','COMPLAINT_UPDATED','SALARY_UPDATED')),
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','accepted','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_id UUID,
  lease_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  provider_id TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_outbox_pending ON email_outbox(next_attempt_at, created_at)
  WHERE status IN ('pending','sending');
CREATE INDEX email_outbox_expiry ON email_outbox(expires_at);
COMMIT;
