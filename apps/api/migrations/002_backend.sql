BEGIN;

ALTER TABLE users
  ADD COLUMN password_hash TEXT,
  ADD COLUMN ceo_display_name TEXT,
  ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN invited_at TIMESTAMPTZ,
  ADD COLUMN activated_at TIMESTAMPTZ,
  ADD COLUMN last_login_at TIMESTAMPTZ;

CREATE TABLE company_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  display_name TEXT NOT NULL,
  legal_name TEXT NOT NULL DEFAULT '',
  statement_address TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL,
  working_weekdays INTEGER[] NOT NULL CHECK (cardinality(working_weekdays) BETWEEN 1 AND 7),
  currency_code TEXT NOT NULL,
  currency_minor_unit INTEGER NOT NULL CHECK (currency_minor_unit BETWEEN 0 AND 3),
  leave_types TEXT[] NOT NULL,
  salary_publication_enabled BOOLEAN NOT NULL DEFAULT false,
  salary_jurisdiction TEXT NOT NULL DEFAULT '',
  calendar_revision INTEGER NOT NULL DEFAULT 0,
  calendar_guard INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  employee_code TEXT NOT NULL UNIQUE CHECK (employee_code = upper(btrim(employee_code))),
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  department TEXT NOT NULL,
  start_date DATE NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  employment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (employment_status IN ('ACTIVE','INACTIVE')),
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX employees_directory ON employees (employment_status, full_name, id);
CREATE INDEX employees_department ON employees (department, employment_status);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  csrf_hash TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  session_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_expiry ON sessions (expires_at);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE TABLE account_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('INVITATION','PASSWORD_RESET')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sent','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX account_tokens_user ON account_tokens (user_id, purpose);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_id UUID,
  request_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_created ON audit_events (created_at DESC, id);
CREATE INDEX audit_events_entity ON audit_events (entity_id, created_at DESC);

CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  work_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ NOT NULL,
  check_out_at TIMESTAMPTZ,
  state TEXT NOT NULL CHECK (state IN ('OPEN','CLOSED')),
  timezone_snapshot TEXT NOT NULL,
  calendar_revision INTEGER NOT NULL,
  non_working_day_flag BOOLEAN NOT NULL,
  approved_leave_flag BOOLEAN NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date),
  CHECK ((state = 'OPEN' AND check_out_at IS NULL) OR
    (state = 'CLOSED' AND check_out_at > check_in_at AND check_out_at <= check_in_at + interval '24 hours'))
);
CREATE UNIQUE INDEX attendance_one_open ON attendance(employee_id) WHERE state = 'OPEN';
CREATE INDEX attendance_date ON attendance(work_date DESC, employee_id);
CREATE TABLE attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  before_values JSONB NOT NULL,
  after_values JSONB NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX corrections_parent ON attendance_corrections(attendance_id, created_at);

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  working_dates DATE[] NOT NULL CHECK(cardinality(working_dates) > 0),
  calendar_revision INTEGER NOT NULL,
  day_count INTEGER NOT NULL CHECK(day_count > 0),
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  decision_by UUID REFERENCES users(id),
  decision_at TIMESTAMPTZ,
  decision_reason TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(day_count = cardinality(working_dates))
);
CREATE INDEX leave_employee ON leave_requests(employee_id, created_at DESC);
CREATE INDEX leave_state ON leave_requests(state, start_date);
CREATE TABLE leave_reservations (
  employee_id UUID NOT NULL REFERENCES employees(id),
  work_date DATE NOT NULL,
  request_id UUID NOT NULL REFERENCES leave_requests(id),
  PRIMARY KEY(employee_id, work_date)
);
CREATE INDEX reservations_request ON leave_reservations(request_id);
CREATE TABLE leave_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES leave_requests(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leave_history_parent ON leave_history(request_id, created_at);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assignee_employee_id UUID NOT NULL REFERENCES employees(id),
  created_by UUID NOT NULL REFERENCES users(id),
  priority TEXT NOT NULL CHECK (priority IN ('LOW','NORMAL','HIGH')),
  state TEXT NOT NULL DEFAULT 'TODO' CHECK(state IN ('TODO','IN_PROGRESS','DONE','CANCELLED')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_assignee ON tasks(assignee_employee_id, state, due_date);
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('WORKPLACE','PAY','TECHNICAL','OTHER')),
  description TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','IN_REVIEW','RESOLVED','CLOSED')),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX complaints_employee ON complaints(employee_id, created_at DESC);
CREATE TABLE complaint_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK(message_type IN ('REPLY','RESOLUTION')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_parent ON complaint_messages(complaint_id, created_at, id);

CREATE TABLE salary_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  published_by_user_id UUID REFERENCES users(id),
  voided_by_user_id UUID REFERENCES users(id),
  period TEXT NOT NULL CHECK(period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  revision INTEGER NOT NULL CHECK(revision > 0),
  state TEXT NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','PUBLISHED','VOIDED')),
  currency_code TEXT NOT NULL,
  currency_minor_unit INTEGER NOT NULL CHECK(currency_minor_unit BETWEEN 0 AND 3),
  earnings JSONB NOT NULL,
  deductions JSONB NOT NULL,
  gross BIGINT NOT NULL CHECK(gross >= 0 AND gross <= 9007199254740991),
  deduction_total BIGINT NOT NULL CHECK(deduction_total >= 0),
  net BIGINT NOT NULL CHECK(net >= 0 AND net = gross - deduction_total),
  note TEXT NOT NULL DEFAULT '',
  employee_snapshot JSONB,
  company_snapshot JSONB,
  template_version INTEGER NOT NULL DEFAULT 1 CHECK(template_version = 1),
  published_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, period, revision),
  CHECK(state = 'DRAFT' OR (published_at IS NOT NULL AND employee_snapshot IS NOT NULL AND company_snapshot IS NOT NULL))
);
CREATE UNIQUE INDEX salary_one_draft ON salary_slips(employee_id, period) WHERE state = 'DRAFT';
CREATE UNIQUE INDEX salary_one_published ON salary_slips(employee_id, period) WHERE state = 'PUBLISHED';
CREATE INDEX salary_owner ON salary_slips(employee_id, period DESC);

CREATE FUNCTION reject_history_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'History is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_history_changes();
CREATE TRIGGER corrections_immutable BEFORE UPDATE OR DELETE ON attendance_corrections FOR EACH ROW EXECUTE FUNCTION reject_history_changes();
CREATE TRIGGER leave_history_immutable BEFORE UPDATE OR DELETE ON leave_history FOR EACH ROW EXECUTE FUNCTION reject_history_changes();
CREATE TRIGGER messages_immutable BEFORE UPDATE OR DELETE ON complaint_messages FOR EACH ROW EXECUTE FUNCTION reject_history_changes();

CREATE FUNCTION protect_salary_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Statements cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF OLD.state <> 'DRAFT' THEN
    IF OLD.state <> 'PUBLISHED' OR NEW.state <> 'VOIDED' OR
       NEW.void_reason IS NULL OR btrim(NEW.void_reason) = '' OR NEW.voided_at IS NULL OR
       NEW.voided_by_user_id IS NULL OR NEW.version <> OLD.version+1 OR
       (to_jsonb(NEW) - ARRAY['state','void_reason','voided_at','voided_by_user_id','version','updated_at']) <>
       (to_jsonb(OLD) - ARRAY['state','void_reason','voided_at','voided_by_user_id','version','updated_at']) THEN
      RAISE EXCEPTION 'Published statements are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER salary_immutable BEFORE UPDATE OR DELETE ON salary_slips FOR EACH ROW EXECUTE FUNCTION protect_salary_snapshot();
COMMIT;
