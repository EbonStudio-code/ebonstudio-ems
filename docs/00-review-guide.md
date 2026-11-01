# 00. Review Guide

**Document status:** Product rules still require business review; technical checkpoint updated  
**Implementation status:** API-connected workspace, preserved preview and local DB upgrade complete; CEO activation/company setup and release pending  
**Date:** 31 October 2026

## 1. What this package does

This package defines the application and its acceptance gates. After approving PostgreSQL and backend completion, the user authorized remaining local setup and frontend integration. See [Backend implementation](14-backend-implementation.md) and [Connected workspace](15-connected-workspace.md). The separate [frontend preview](12-frontend-review.md) remains fictional browser data under `/preview`; other routes use the API.

Confirmed requirements come from the conversation. All other details are proposed design decisions. They can be changed before implementation.

## 2. Recommended review order

### First: product decisions

1. [Product requirements](01-product-requirements.md): confirm what is included and excluded.
2. [Module specifications](02-module-specifications.md): confirm daily employee and CEO workflows.
3. [UI and UX specification](07-ui-ux-specification.md): confirm the intended screens.
4. [Decisions and risks](11-decisions-and-risks.md): resolve the business questions.

### Second: technical decisions

5. [Architecture](03-architecture.md) and [data model](04-data-model.md).
6. [API contracts](05-api-contracts.md) and [security](06-security-and-permissions.md).
7. [Testing](08-testing-and-acceptance.md) and [operations](10-deployment-and-operations.md).
8. [Implementation roadmap](09-implementation-roadmap.md): approve one reviewable phase at a time.

## 3. Scope and business review record

| Decision | Proposed direction | User response |
| --- | --- | --- |
| First-release scope | The nine areas listed in the product requirements | Not yet recorded |
| Roles | CEO and Employee only | Confirmed |
| Architecture | Modular React/Express/PostgreSQL monolith | PostgreSQL approved; TypeScript frontend and JavaScript backend implemented |
| Attendance | Browser check-in/out, one session per company-local day, no location tracking | Not yet recorded |
| Leave | Full-day requests, CEO approval, no accrued leave balances in version 1 | Not yet recorded |
| Complaints | Named, private employee-to-CEO threads | Not yet recorded |
| Salary slips | CEO enters figures; employee downloads their own PDF; no payroll calculations | Not yet recorded |
| Review process | Assistant completes remaining backend; user reviews | Latest implementation request confirmed; production remains gated |

Blank answers do not count as approval. Do not implement unapproved policy assumptions silently.

## 4. Business information needed before the affected features are finalized

- Company display name and any logo/brand preferences.
- Company IANA timezone, such as a named region/city, rather than a fixed UTC offset.
- Working days of the week and the first holiday calendar.
- Currency and company details that must appear on salary slips.
- Country/jurisdiction and any legally required payslip fields.
- Leave type labels and whether future leave-balance tracking is needed.
- Whether employees may see coworkers' names and work contacts. The proposed first release allows employees to see **only their own employee profile**.
- Maximum permitted backdated leave requests, if any. The proposed first release does not allow employees to create backdated requests.
- Data retention and employee exit policies.
- Hosting region, operating budget, email delivery provider, and domain.

Branding can remain neutral during early development. Timezone must be set before attendance or leave use. Currency must be set before creating a salary draft; required company metadata and jurisdiction-specific fields must be reviewed before publication. Hosting and retention decisions must be resolved before production.

## 5. Review checklist

- [ ] The agreed modules are correct.
- [ ] Excluded features really can wait.
- [ ] Employee privacy boundaries are acceptable.
- [ ] Attendance, leave, complaint, and salary-slip rules match company policy.
- [ ] There is no unintended HR/manager role or multi-company requirement.
- [ ] The proposed data model and API ownership make sense.
- [ ] Security and release requirements are acceptable.
- [ ] The phased implementation order is approved.

## 6. Approval record

The user approved the rough frontend, PostgreSQL, backend completion, then remaining local setup and integration. That authorization does not approve database resets, public deployment, real emails/imports or unresolved production policies.

When approval is given, record the document version/date, the approved phase, any exceptions, and unresolved questions. Approval of one phase is not approval to add extra modules or to deploy publicly.

## 7. What has not been done

Connected frontend and Express/PostgreSQL code exist and isolated tests used synthetic data. Actual local backup/migrations/grants and the user-approved fictional CEO invitation are complete. CEO password activation, company settings, real email, cloud setup, public deployment and full acceptance remain outstanding.
