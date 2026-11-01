# 11. Decisions and Risks

**Updated:** 31 October 2026  
**Status:** Connected workspace delivered/tested and authorized local backup/migration/grants complete. Fictional Demo CEO invited; password/company setup and production-policy/release approval remain pending.

## 1. Confirmed decisions

| ID | Decision | Source |
| --- | --- | --- |
| C-01 | Original MERN request; database choice superseded by C-10 | Historical user request |
| C-02 | Start with 1 CEO and 10 employees | User clarification |
| C-03 | Design for adding modules later | User request |
| C-04 | Initial access roles are CEO and Employee only | Latest team-size/scope clarification |
| C-05 | Base features plus attendance, leave, tasks, complaints, holidays, salary slips | User's selected module list |
| C-06 | Assistant will write the code; user will review | User clarification |
| C-07 | Create documents before code | Initial instruction, superseded for coding by later approvals |
| C-08 | Plan for roughly 1,000 total users in future | User growth estimate |
| C-09 | Build all rough CEO and Employee frontend pages now; polish later | Latest user instruction |
| C-10 | Replace MongoDB with PostgreSQL 18; retain React/Express/Node | Subsequent explicit user approval |
| C-11 | Assistant completes the remaining backend after the hands-on tutorial phase | Latest explicit implementation request |
| C-12 | Continue remaining local setup and connect the frontend while preserving demo data | Subsequent “GO AHEAD AND DO REMAIN JOB” instruction |
| C-13 | Use Demo CEO / ceo@example.test for local testing, with private setup-link delivery and no real email | Explicit user selection after database setup |

Earlier discussion of HR/manager accounts is superseded by the minimal first-release scope. Those roles remain possible future additions, not hidden initial functionality.

## 2. Proposed technical decisions

| ID | Proposal | Why |
| --- | --- | --- |
| T-01 | Modular monolith rather than microservices | Simpler deployment and learning/review at this scale |
| T-02 | Implemented React/TypeScript and JavaScript ESM API; shared contracts deferred | Preserve the user's working backend foundation |
| T-03 | Implemented PostgreSQL constraints/transactions and tracked SQL migrations | Supersedes MongoDB/Mongoose; safe adoption of manually executed 001 |
| T-04 | Same-origin frontend/API with server-side sessions | Straightforward revocation and cookie security |
| T-05 | Deploy-time module registry; no live plugin marketplace | Extensible without arbitrary code loading or extra administration |
| T-06 | No general upload/storage system initially | Smaller privacy and security footprint |
| T-07 | Server-generated, authenticated salary PDFs | Private distribution and controlled templates |
| T-08 | Unit, API, component, and browser tests per phase | Reviewable evidence rather than end-of-project testing |
| T-09 | One PostgreSQL advisory lock for domain writes in the initial implementation | Correct lifecycle/calendar races; benchmark before finer-grained optimization |

## 3. Proposed business defaults

| ID | Proposal | Consequence |
| --- | --- | --- |
| B-01 | CEO account is separate from employee profiles | CEO does not use employee attendance/leave/slip flows |
| B-02 | Employees view only own profile, not a company-wide directory | Stronger default privacy |
| B-03 | One daily attendance session, no GPS/breaks/overtime | Simple check-in/out, not full workforce time tracking |
| B-04 | Only existing attendance records can be corrected | Missing punches cannot yet be entered manually |
| B-05 | Full-day future/today leave, CEO decisions, no balances | Request tracking, not entitlement/payroll management |
| B-06 | Named employee-to-CEO complaints | Confidential but not anonymous; CEO is sole reviewer |
| B-07 | Manual monthly salary statements with calculated totals | No statutory tax calculation, automated payroll, or payment confirmation |
| B-08 | One timezone/workweek/currency/company calendar | No branch-specific policy |
| B-09 | Deactivation requires resolving open attendance, active leave blockers, unfinished tasks | Prevents stranded work; CEO exit checklist is required |
| B-10 | Published slips are immutable; void and reissue | Retained correction history |
| B-11 | Account setup/recovery through email links | An authorized email service is needed for real use |

The detailed limits in the module specifications and API contracts are also proposals, not user-supplied policy.

## 4. Open decisions

| ID | Question | Needed by |
| --- | --- | --- |
| O-01 | Company name/branding | UI refinement and company setup |
| O-02 | Company timezone and working weekdays | Attendance/leave setup |
| O-03 | Currency, country/jurisdiction, required payslip fields | Salary-slip implementation acceptance |
| O-04 | Leave categories/backdating/half-day/balance expectations | Leave approval of scope |
| O-05 | Is web check-in sufficient, and is missing-punch entry needed now? | Attendance acceptance |
| O-06 | Are named complaints to the CEO sufficient, including complaints concerning the CEO? | Complaint acceptance |
| O-07 | Employee retention, complaint retention, salary-record retention, legal holds | Production policy |
| O-08 | Hosting provider/region/domain/budget and email provider | Deployment planning |
| O-09 | Is CEO MFA required for the first production release? | Production security gate |
| O-10 | Who can perform verified CEO recovery or a future CEO handover? | Production operations |
| O-11 | User completes Demo CEO password/company settings, then reviews connected workspace | Next local acceptance stage |

No external service, jurisdiction, or company policy is silently chosen to close these questions.

## 5. Risk register

| Risk | Impact | Mitigation / decision |
| --- | --- | --- |
| CEO account compromise | Access to all private employee records | Strong sessions/passwords, rate limits, review MFA before production |
| Complaint concerns the CEO | No independent reviewer in current roles | Disclose limitation; user chooses an external process or later approved role |
| Salary statements mistaken for payroll compliance | Incorrect legal/tax assumptions | Explicit scope boundary and jurisdiction review |
| Browser attendance mistaken for proof of physical presence | Inaccurate management decisions | State that there is no location/biometric verification |
| Missing punches cannot be entered manually | Incomplete attendance history | Review before relying on attendance; add only with approved scope |
| Timezone/calendar changes alter history | Incorrect attendance/leave dates | Lock foundational settings; snapshot dates; reviewed migration for changes |
| Concurrent actions corrupt state | Duplicate or conflicting records | Unique constraints, transactions, coordination guards, race tests |
| Hidden cross-employee access | Disclosure of complaints/pay | Server ownership checks on every list/detail/action/PDF route |
| Deactivation leaves active work | Stranded tasks/attendance/leave | Blocking-work checks under lifecycle guard |
| 1,000 users interpreted as 1,000 concurrent sessions | Under-tested capacity claim | Separate total users from measured workload; load-test documented concurrency |
| Email delivery failure | Employees cannot activate/recover access | Explicit resend, delivery status, provider monitoring |
| Single CEO unavailable | Approval/support bottleneck | Define operational recovery; add delegated roles only after review |
| Retention not defined | Excess data exposure or unlawful deletion | Block production policy sign-off until resolved |
| Overbuilding the first release | Harder review and delayed usefulness | Small phases, strict exclusions, modular boundaries |

## 6. Change and approval log

| Date | Change | Approval |
| --- | --- | --- |
| 29 October 2026 | Initial documentation package created from agreed scope | Awaiting user review |
| 29 October 2026 | User requested the whole rough frontend for CEO/Admin and Employee | Frontend-only implementation approved; backend and production policy approval still outstanding |
| 31 October 2026 | User switched to PostgreSQL, completed the foundation, then requested remaining backend implementation | API/schema/scripts/tests authorized; no real data reset, real email or public deployment |
| 31 October 2026 | Backend implemented and verified using isolated PostgreSQL | See document 14; actual development migration and frontend integration remain operator/review steps |
| 31 October 2026 | Connected workspace and safe local setup command implemented after continuation approval | Initially blocked by owner login error 28P01; resolved in the following checkpoint |
| 31 October 2026 | User clarified the two database passwords and corrected the owner file; actual backup/upgrade/grants succeeded | Passwords unchanged; user selected a fictional CEO and its private invitation was created |

The latest request authorizes integration, safe local setup and the explicitly chosen fictional CEO, not database resets, real-data imports, real email, public deployment or unresolved business-policy sign-off. UTC/USD remain fictional fixtures. Company settings are still empty; publication remains explicitly gated. Evidence and remaining gates are in [Backend implementation](14-backend-implementation.md) and [Connected workspace](15-connected-workspace.md).
