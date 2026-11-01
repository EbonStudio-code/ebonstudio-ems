# 09. Implementation Roadmap

**Current checkpoint: 31 October 2026.** The API-connected workspace is implemented and synthetic tests pass. Owner authentication was corrected, the actual database was backed up/upgraded, and the user-approved fictional CEO is invited. Website activation/company setup and production release are not complete.

## 1. Working agreement

The earlier tutorial phase, where the user typed the backend foundation, ended when the user asked the assistant to complete the remaining backend. JavaScript/Express and the user's manually executed PostgreSQL migration 001 were preserved.

No existing database reset, real employee import/email, paid infrastructure or public deployment is included. Unresolved company policy is not silently replaced with UTC/USD demo fixtures.

## 2. Delivery status

| Slice | Current status |
| --- | --- |
| Frontend rough screens/dark mode/QA fixes | Existing preview preserved under `/preview`; 50 browser regressions pass |
| PostgreSQL schema and tools | Migration 002, checksum journal, verified manual-001 baseline, runtime grants and operator scripts implemented |
| Identity/company/employees | Sessions/CSRF, tokens, bootstrap, settings and lifecycle implemented/tested |
| Holidays/attendance/leave | Calendar impact, punches/corrections, snapshots/reservations and races implemented/tested |
| Tasks/complaints | Scope/transitions, immutable thread history and lifecycle coordination implemented/tested |
| Salary | Draft/publish/void/reissue, snapshots and authenticated PDF generation implemented/tested |
| Dashboard/audit/registry | Scoped summaries, atomic audit and retained-data disablement implemented/tested |
| Actual development database upgrade | Backed up, compatible 001 adopted, 002 applied, limited grants verified; fictional CEO invited |
| Frontend API wiring | Implemented across all modules; 95 frontend tests and 31 browser assertions pass; no live role switcher |
| Safe local setup command | Backup/adoption/grants and isolated restore tested; preserves existing accounts |
| Real SMTP, deployment, load and actual-data restore | Not performed; separate release gates |

See [Backend implementation](14-backend-implementation.md) and [Connected workspace](15-connected-workspace.md) for commands, counts and limitations. Passing automated tests does not mean complete application acceptance.

## 3. Next review sequence

1. Complete the Demo CEO website password through its private local setup link.
2. Enter explicitly reviewed company settings; no test-company defaults are silently applied.
3. Review the connected workflows on the intended local setup. Do not import demo state into real records.
4. Visually verify authenticated PDFs, draft/void labels and company-language fonts.
5. Show the desktop browser pane for independent keyboard tests; complete remaining visual, screen-reader and OS download/print acceptance.
6. Benchmark representative history/concurrency, Argon2, global write-lock contention, queries and PDFs.
7. Complete backup restore, deployment/security smoke tests, policy decisions and explicit release approval.

## 4. Decisions still required

| Before | Decision |
| --- | --- |
| Company use | Name, timezone, workweek and leave labels/policies |
| Salary publication | Currency, legal fields, jurisdiction review and statement scope |
| Attendance acceptance | One-session limit, correction policy, missing-punch limitation |
| Complaint acceptance | Named complaints to CEO and conflicts concerning the CEO |
| Real email | Authorized provider, sender, recipients and permission to send |
| Production | Hosting/domain/region, retention, backups, MFA and verified CEO recovery |

A configurable gate is not legal/business approval. No accrual/payroll/location/HR-manager feature was added.

## 5. Module completion versus release

A backend slice is delivered when its routes/schema/workflows and relevant API tests exist. Full application completion additionally requires connected UI behavior, browser/error/accessibility acceptance and user review. Production readiness adds operational/security/load/policy gates.

Future scope additions require updates to requirements, permissions, schema/contracts, tests and operations. Keep modules focused; do not turn tasks into project management or salary statements into a payroll engine.

No production capacity, deadline, uptime or legal-compliance guarantee is made by this checkpoint.
