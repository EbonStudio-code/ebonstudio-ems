BEGIN;

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  email_canonical TEXT NOT NULL UNIQUE,

  role TEXT NOT NULL
    CHECK (role IN ('CEO', 'EMPLOYEE')),

  status TEXT NOT NULL DEFAULT 'INVITED'
    CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  version INTEGER NOT NULL DEFAULT 0
    CHECK (version >= 0),

  CONSTRAINT users_email_canonical_check
    CHECK (
      email_canonical = lower(btrim(email_canonical))
      AND email_canonical <> ''
    )
);

CREATE UNIQUE INDEX users_single_ceo
  ON public.users (role)
  WHERE role = 'CEO';

COMMIT;
