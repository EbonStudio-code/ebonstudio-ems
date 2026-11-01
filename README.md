# Employee Management Website

**Status: API-connected React workspace and local database setup implemented and tested. The fictional demo remains at `/preview`. Demo CEO is invited; its password and company settings are the next user steps. This is not a production release.**

Prepared on 29 October 2026 for a company with **1 CEO and 10 employees**, with a future target of approximately **1,000 total users**.

The stack is **PostgreSQL 18, Express, React, and Node.js**. The user-approved PostgreSQL decision supersedes the original MongoDB/MERN proposal. React uses TypeScript; the backend preserves the user's JavaScript ESM foundation. The architecture is a modular monolith, not separate microservices.

## Agreed first release

1. Secure login and CEO/Employee permissions.
2. Employee directory and profiles.
3. Role-specific dashboards.
4. Attendance.
5. Leave requests.
6. Task assignments.
7. Complaints.
8. Holidays.
9. Salary slips.

The user authorized backend completion, remaining local setup and integration, then selected a fictional Demo CEO for testing. Account security, feature APIs, connected screens, actual local migrations and tests are complete. Website activation/company settings, production policies, real emails and deployment remain separate steps.

## Backend setup and verification

Start with [Backend implementation and safe setup](docs/14-backend-implementation.md). The existing application database was backed up and upgraded after the user corrected owner credentials. It was not reset. Runtime credentials remain in `.env`; migration-owner credentials stay in separate ignored `.env.admin`.

```powershell
npm run test:api
npm run test:api:integration
npm run check:api
```

Verified: **95 frontend tests, 14 backend unit tests, 41 PostgreSQL integration scenarios** (43 including parent tests), **31 connected-browser assertions and 50 preview-browser assertions**. Typecheck/build, API syntax and dependency audit pass (zero advisories). Integration tests create their own temporary PostgreSQL 18 clusters, including a synthetic backup/restore test. They do not use the existing application database.

The initial owner authentication problem is resolved. Backup, compatible 001 adoption, migration 002 and limited runtime grants succeeded without changing existing accounts. The user-approved fictional **Demo CEO / `ceo@example.test`** now has an invitation in a private local file, not a real email.

`npm run setup:local --workspace @ems/api` is the tested backup/migration/grants command; the current database has already completed it. See [the setup record and password-link instructions](docs/15-connected-workspace.md). Do not rerun manual 001 or reset the database.

Then run `npm run dev:api` in one terminal and `npm run dev` in another. Default API address is `http://127.0.0.1:3000`; Vite proxies `/api` to it. See [Connected workspace setup and evidence](docs/15-connected-workspace.md).

## Run the frontend

Use Node.js 22.12+ in the 22.x line, Node.js 24.x, or a compatible newer even-numbered release.

From this repository:

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:5173/login** for the connected workspace. It requires the configured API, migrated database and activated account; there is no default password or role switcher.

To review without a backend, open **http://127.0.0.1:5173/preview/login**. Choose **CEO** or **Employee** in the fictional demo, without a password. Its old browser records and role switcher are preserved.

Use the **moon/sun theme button** in the workspace header or sign-in screen to switch between light and dark mode. Your browser remembers the choice across pages and sessions. Until you choose, the preview follows your device's color scheme. Printed salary statements stay light.

```powershell
npm run typecheck
npm test
npm run build
```

The frontend lives in `apps/web`. Connected pages and API/session state are in `src/live`; the preserved demo pages remain in `src/modules`. Connected records stay on the API, with private responses held only in memory. Theme preferences remain browser-saved.

**Use fictional data only during review.** `/preview` is not secure authentication or production access control: anyone with browser access can change its records. It simulates invitations and uses browser printing. The connected workspace instead uses server sessions/permissions, controlled invitations and authenticated PDF downloads. No demo data is imported into PostgreSQL.

Use **Reset demo** to restore the sample records. See the [frontend review guide](docs/12-frontend-review.md) for routes, testing instructions, and limitations.

## Document map

| Document | Purpose |
| --- | --- |
| [00. Review guide](docs/00-review-guide.md) | Reading order, approval checklist, and unanswered business questions |
| [01. Product requirements](docs/01-product-requirements.md) | Scope, users, exclusions, and product requirements |
| [02. Module specifications](docs/02-module-specifications.md) | Detailed rules and workflows for each feature |
| [03. Architecture](docs/03-architecture.md) | Module boundaries, technology choices, and future expansion |
| [04. Data model](docs/04-data-model.md) | PostgreSQL tables, relationships, constraints, and indexes |
| [05. API contracts](docs/05-api-contracts.md) | Endpoints, payload fields, errors, and authorization rules |
| [06. Security and permissions](docs/06-security-and-permissions.md) | Access matrix, privacy, authentication, and threat controls |
| [07. UI and UX specification](docs/07-ui-ux-specification.md) | Screens, navigation, accessibility, and responsive behavior |
| [08. Testing and acceptance](docs/08-testing-and-acceptance.md) | Test strategy, acceptance scenarios, and release gates |
| [09. Implementation roadmap](docs/09-implementation-roadmap.md) | Small implementation phases with user review checkpoints |
| [10. Deployment and operations](docs/10-deployment-and-operations.md) | Environments, production setup, backups, and support |
| [11. Decisions and risks](docs/11-decisions-and-risks.md) | Confirmed decisions, proposed defaults, and open risks |
| [12. Frontend review](docs/12-frontend-review.md) | Running and reviewing the preserved fictional preview |
| [13. QA fixes](docs/13-qa-fixes.md) | Preserved frontend regression evidence and blocked checks |
| [14. Backend implementation](docs/14-backend-implementation.md) | Delivered APIs, safe migration/bootstrap, tests and release gates |
| [15. Connected workspace](docs/15-connected-workspace.md) | API-connected screens, local blocker, browser evidence and remaining gates |

## Important boundaries

- Only **CEO** and **Employee** roles are in the first release.
- Salary slips are manually entered salary statements, not automatic payroll, tax filing, or bank payments.
- Connected complaint access is enforced by the API for the submitting employee and CEO. The separate demo cannot secure browser-stored data.
- UTC, USD, and fictional company details are clearly labeled demo fixtures, not decisions about the real company.
- Business rules and technical choices described as **proposed** require review.
- The actual local database was upgraded and only the explicitly approved fictional CEO was invited. No real employee accounts/emails or public deployment occurred. Keyboard, screenshot/PDF visual, production security and load acceptance are not complete.

Start with the [frontend review guide](docs/12-frontend-review.md) to try the app, or the [planning review guide](docs/00-review-guide.md) to review the proposed full-stack design.
