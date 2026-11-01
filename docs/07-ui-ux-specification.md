# 07. UI and UX Specification

## 1. Design direction

Proposed visual style: a clean, restrained business dashboard with a neutral background, clear typography, one brand accent, accessible contrast, and status labels that do not rely on color alone.

Company name, logo, and final colors are not supplied. Use clearly temporary branding during development, not an invented company identity.

Optimize first for a busy CEO and employees performing quick daily actions. Avoid charts that do not help a decision, crowded dashboards, and decorative complexity.

## 2. Application shell

### Desktop

- Left navigation showing enabled modules available to the current role.
- Top bar with page title, company timezone context where needed, and account/logout menu.
- Main content with a clear primary action.
- Consistent table filters, pagination, status badges, and confirmation dialogs.

### Mobile

- Compact header and accessible collapsible navigation.
- Stack dashboard cards.
- Convert wide record summaries to readable cards or a labeled horizontal table region.
- Keep check-in/out, leave submission, and task status controls easy to reach.
- No page-level horizontal scrolling at 360 CSS pixels.

## 3. Navigation

| CEO | Employee |
| --- | --- |
| Dashboard | Dashboard |
| Employees | My profile |
| Attendance | My attendance |
| Leave requests | My leave |
| Tasks | My tasks |
| Complaints | My complaints |
| Holidays | Holidays |
| Salary slips | My salary slips |
| Company settings | Account security |
| Audit history | |
| Account security | |

The last two CEO areas are supporting administration, not extra HR modules. Disabled feature entries and their routes are absent.

## 4. Screen inventory

### Access

- Login: email, password, show/hide password, recovery link.
- Accept invitation: valid-link state, password setup, expiry/used-link guidance.
- Forgot/reset password: generic confirmation and safe invalid-token state.
- Session expiry: clear message, return to login, no private content left visible.
- Change password: current/new password, session revocation explanation.

### CEO dashboard

Headcount, checked-in count, open attendance, leave today, pending leave, overdue tasks, complaint count, and next holiday. Cards link to filtered module screens. Complaint bodies and salary amounts do not appear.

Show loading, genuine zero, disabled module, and data error as distinct states. Do not turn a failed count request into a misleading zero.

### Employee dashboard

Prominent attendance action and current status; personal task list; leave summary; complaint status; upcoming holiday; link to latest salary slip.

### Employees

- CEO directory with search, department/status filters, pagination, and invite action.
- Detail with profile, account state, and appropriate administrative actions.
- Create/edit form with field-level validation.
- Deactivation dialog lists live blockers and requires a reason.
- Employee self-profile is mostly read-only; phone is editable.

### Attendance

- Employee today panel plus date-filtered history.
- Explicit company timezone and check-in work date.
- Cross-midnight/open-record warning and correction guidance.
- CEO daily view with employee/state filters.
- Correction dialog shows prior values, proposed values, and required reason.
- Affected employee can see correction history.

### Leave

- Employee request form, working-date preview, and own history.
- Show that leave balance tracking is not included; never display a fabricated balance.
- CEO pending queue and request detail.
- Approve confirmation; reject/cancel dialogs require the appropriate reason.
- State history and snapshotted day count are visible.
- Explain weekend/holiday exclusions and overlapping-date errors.

### Tasks

- Paginated/filterable list, not a full project-management board.
- CEO create/edit/reassign form.
- Task detail with assignee, priority, due date, and state.
- Employee progress controls only; no editable assignee or due date.
- Reassigned task that is no longer visible exits gracefully from the old employee's screen.

### Complaints

- Privacy statement before submission: visible to you and the CEO, not anonymous.
- Subject/category/description form.
- Private list showing subject, status, and date; no unrelated employee data.
- Thread detail with chronological replies and explicit resolution.
- Reopen/close options only from Resolved.
- Closed threads are read-only.

### Holidays

- Calendar and accessible list view for the selected year.
- Working weekdays explained separately.
- CEO editor with impact preview and affected leave list.
- Explicit acknowledgement that historical leave snapshots will not change.
- Stale impact response requires a fresh preview, not silent submission.

### Salary slips

- CEO list by employee, month, and state.
- Employee list restricted to own Published/Voided revisions.
- CEO draft editor with earnings/deductions, currency, and server-confirmed totals.
- Preview shows DRAFT clearly.
- Publish confirmation states that financial values become immutable.
- Void dialog requires a reason and explains replacement revision workflow.
- Employee detail and PDF download show VOID prominently on invalidated statements.
- A salary slip does not display a Paid badge because payment is not tracked.

### Company settings and audit

- Settings show company name, timezone, workweek, currency, and required statement metadata.
- Locked fields explain why they cannot change without a migration.
- Audit list uses actor/action/entity/time and safe metadata, never full complaint or salary content.

## 5. Interaction rules

- Disable duplicate submit while a mutation is pending, but rely on server constraints for correctness.
- Use explicit confirmation for deactivation, corrections, leave decisions, holiday removal, publication, and voiding.
- Do not optimistically publish/void a slip, approve leave, or mark attendance complete before server confirmation.
- On a version conflict, keep the user's input, load current data, and ask for review before resubmitting.
- After an ambiguous timeout, offer refresh/check status instead of blindly repeating a create operation.
- Show success only after a successful response. Do not hide failed API calls behind sample data.
- Use neutral sample data only in isolated development/test fixtures, never as a production fallback.

## 6. Accessibility

Target WCAG 2.2 AA for implemented screens:

- Semantic landmarks, headings, labels, and table headers.
- Visible keyboard focus and logical tab order.
- Dialog focus trapping and return to the triggering control.
- Keyboard-operable dates, menus, tabs, and status controls.
- Text error messages associated with their fields.
- Accessible live announcements for submission outcomes, not every background refresh.
- Adequate contrast, readable zoom/reflow, and reduced-motion support.
- Icon-only buttons have accessible names.

Automated checks are necessary but do not replace manual keyboard and screen-reader review.

## 7. Formatting rules

- Show user-facing dates clearly; store ISO date strings through the API.
- Use the company timezone for business dates, with explicit context in attendance.
- Format money using the configured currency and exponent.
- Reject excess decimal precision instead of silently rounding entered salary figures.
- Distinguish empty, unavailable, and permission-denied states.
- Protect private pages and clear query caches on logout.
