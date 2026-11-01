# 02. Module Specifications

These rules are implemented in the PostgreSQL API unless a limitation is recorded in [Backend implementation](14-backend-implementation.md). They remain subject to company-policy and user acceptance review. The [connected workspace](15-connected-workspace.md) uses these APIs; the separate `/preview` demo remains fictional. Role checks apply on the API.

## 1. Shared rules

- One company, one CEO, ten initial employee accounts.
- Company timezone defines today, working dates, holiday dates, due dates, and leave dates.
- CEO accounts are not included in employee headcount or employee self-service workflows.
- Historical records survive employee deactivation. Inactive accounts cannot sign in.
- Only active employees whose start date has arrived can check in or submit leave.
- Destructive deletion of employees, attendance, leave, complaints, and published salary slips is not available in the UI.
- Domain changes and their audit entries commit together. Invalid or conflicting requests make no partial change.
- Free-text input is plain text, length-limited, and safely rendered.
- Default list order is newest first, except calendars and employee names. Lists are paginated.

## 2. Accounts and access

### CEO initialization

A controlled deployment-only setup process creates the single CEO account and sends a short-lived password-setup link. There is no public CEO signup, default password, or API that promotes an employee to CEO. The setup process refuses to create a second CEO.

### Employee provisioning

1. CEO creates an employee using name, work email, employee code, job title, department, and start date.
2. Account and profile are created atomically. Account starts as invited; employment status starts as active.
3. An invitation is sent to the work email using the configured email provider.
4. Employee follows a one-use, expiring link and chooses a password.
5. Account becomes active. The employee signs in normally.

Failed email delivery leaves the account invited and exposes a resend action to the CEO. It does not roll back an otherwise valid employee record or reveal a setup token in the UI.

### Session and recovery

- Password setup links expire after 24 hours; recovery links after 30 minutes.
- Resending or successfully using a link invalidates all outstanding account tokens for that account.
- Password reset invalidates all existing sessions.
- Deactivation suspends the account, revokes sessions and outstanding account tokens, and keeps historical data.
- Implemented session limits: 30 minutes of inactivity and 8 hours absolute lifetime.
- Repeated login/recovery attempts are rate-limited. Public recovery responses do not reveal whether an email exists.

## 3. Employees

### CEO capabilities

- Search and filter the employee directory by name, employee code, department, and employment status.
- Create and update employee details.
- Resend invitations.
- Deactivate an employee with a reason.
- Reactivate a deactivated employee; require a fresh password-setup flow before access is restored.

### Employee capabilities

- View own profile and work account details.
- Update own phone number only.
- Change own password after providing the current password.
- Employment details, email, employee code, and displayed name are CEO-managed.

### Rules

- Email and employee code are unique, including historical/inactive records.
- Email changes revoke sessions and account tokens and require a new invitation; no account takeover by changing email on a live session.
- No deletion endpoint. Retention-based erasure is a separate, approved operational process.
- Deactivation is blocked while the employee has an open attendance record, any pending leave request, or approved leave with at least one reserved date on/after today. CEO must explicitly resolve/cancel those first.
- Unfinished tasks assigned to the employee must be reassigned or cancelled before deactivation.
- Complaints remain visible to the CEO and are not automatically resolved by deactivation.

## 4. Dashboards

### CEO dashboard

- Active headcount, excluding the CEO and future starters.
- Employees checked in today and currently open attendance.
- Employees on approved leave today.
- Pending leave requests.
- Unfinished and overdue tasks.
- Unresolved complaints, as counts and links without complaint text.
- Upcoming holidays.

On a non-working day, the UI must not describe employees as absent. On a working day, use **Not checked in**, not a disciplinary absence classification. Exclude employees on approved leave and future starters from that list.

### Employee dashboard

- Own check-in/out state and today's attendance.
- Own pending leave and next approved leave.
- Assigned unfinished tasks and due dates.
- Own complaint status counts.
- Next holiday.
- Link to latest published salary slip, without placing salary amounts in dashboard summaries.

Widgets appear only for enabled modules. Dashboard does not directly query another module's private collections.

## 5. Attendance

### Employee workflow

1. Employee selects Check in.
2. Server records the current instant and derives the work date from company timezone.
3. Employee later selects Check out.
4. Server closes the existing open record, including when checkout is after midnight.

### Rules

- At most one attendance record per employee per company-local date.
- At most one open record per employee.
- The client cannot submit a trusted punch timestamp.
- Check-in is blocked while any earlier record remains open.
- Checkout must be later than check-in and no more than 24 elapsed hours after it. Stale records require CEO correction rather than an invented automatic checkout.
- Cross-midnight attendance remains attached to the check-in work date.
- Check-in on a holiday, weekend, or approved leave is allowed but visibly flagged. It does not cancel leave or change salary.
- Punch-time flags remain historical snapshots. Detail/history views also show a separate current approved-leave overlap flag, so leave approved or cancelled after a punch is reflected without rewriting the original flags.
- Duration is elapsed time between server timestamps, not a payroll or overtime calculation.
- No break clock or multiple daily sessions.
- Concurrent/double-click check-in or checkout requests cannot duplicate or overwrite a completed punch.

### CEO correction

CEO may correct an existing record's check-in and checkout times, with a required reason. The employee and work date cannot be changed. Corrected check-in must still belong to that work date; closed duration must remain positive and at most 24 hours. Original values remain in an append-only correction history visible to the CEO and record owner.

Creating an entirely missing attendance record manually is deferred. This limitation must be reviewed before attendance is treated as an official payroll input.

## 6. Leave requests

### Request

- Employee selects type, start date, end date, and a reason.
- Full-day requests only.
- Start date cannot be before company-local today; end date cannot precede start date.
- Technical maximum range: 366 calendar days; at least one eligible working date is required.
- Proposed labels: Annual, Sick, Unpaid. Labels do not calculate pay or entitlement.
- Working dates exclude configured weekends and recorded holidays.
- The eligible working-date list and day count are snapshotted on submission.
- No automatic allowance, accrual, or balance validation in version 1.

### States

| From | Action | Who | To |
| --- | --- | --- | --- |
| None | Submit | Employee | Pending |
| Pending | Approve | CEO | Approved |
| Pending | Reject with reason | CEO | Rejected |
| Pending | Withdraw | Owning employee | Cancelled |
| Pending | Cancel with reason | CEO | Cancelled |
| Approved | Cancel with reason | CEO | Cancelled |

Rejected and cancelled requests are terminal. Editing submitted dates is not supported; cancel and submit a replacement.

### Invariants

- Pending and approved requests cannot reserve the same employee working date.
- A unique employee/date reservation table and transactions enforce this under concurrent submissions.
- Rejection/cancellation releases reservations atomically; approval retains them.
- Approval uses the submitted day list, not a silently recalculated one.
- Later holiday/calendar changes do not rewrite existing requests. CEO sees an impact warning and may cancel and replace affected requests.
- Attendance overlapping an approved leave date is flagged for CEO review through the live overlap read interface, including when leave is approved after check-in. Pending requests alone do not create this flag. Leave and attendance are not automatically reconciled.

## 7. Task assignments

- CEO creates a task with title, description, one active employee assignee, priority, and optional due date.
- Priorities: Low, Normal, High.
- States: To do, In progress, Done, Cancelled.
- Employee sees only currently assigned tasks.
- Employee may move their own non-cancelled task among To do, In progress, and Done.
- CEO may edit task details, reassign, change any state, cancel, or reopen.
- Reassignment immediately removes the previous assignee's access.
- Tasks are overdue when due date is before today and state is neither Done nor Cancelled.
- Concurrent edits use a version check; stale edits return a conflict.
- No project hierarchy, comments, attachments, or employee self-assignment.

## 8. Complaints

### Privacy

A complaint is visible only to its submitting employee and the CEO. It is **not anonymous**. The submission screen states this clearly. There are no shared complaint lists for employees and no CEO-only notes inside the thread.

### Content and workflow

- Employee submits a subject, category (Workplace, Pay, Technical, Other), and description.
- Both participants can add immutable text replies while the complaint is not Closed.
- States: Open, In review, Resolved, Closed.
- CEO moves Open to In review, then to Resolved with a required resolution message.
- The employee or CEO may reopen Resolved to In review.
- The employee or CEO may close a Resolved complaint.
- Closed complaints are read-only and retained.
- Original submission and replies cannot be edited or deleted through the UI.
- No attachments, anonymous submissions, automatic escalation, or external forwarding.

Complaint text must not appear in dashboards, email subjects, analytics, request logs, or generic audit metadata.

## 9. Holidays

- One company-wide calendar in company timezone.
- CEO creates full-day holidays with a name, date, and optional note.
- Employees can view the calendar and upcoming holiday list.
- One holiday entry per date. Combined holidays use one descriptive name.
- Today/future entries can be edited or removed with a reason; past entries are read-only.
- Before a change, show affected pending/approved leave requests. Acknowledgement of the current impact version is required before committing.
- Existing leave date snapshots and attendance flags do not change silently.
- New leave requests and new attendance records use the updated calendar.
- Company working weekdays are stored in settings, not as repeated holiday records.

## 10. Salary slips

### Scope

Internal monthly salary statements entered by the CEO. Not a payroll engine, evidence that payment happened, tax advice, or a guarantee of statutory payslip compliance.

### CEO workflow

1. Choose an employee and salary month.
2. Enter named earning and deduction lines and an optional note.
3. Review computed gross, deductions, and net.
4. Preview a DRAFT-marked PDF.
5. Publish after confirmation.

### Rules

- Amounts use nonnegative integer minor units in the configured company currency.
- At least one earning line; at most 20 earning lines and 20 deduction lines.
- Net equals total earnings minus total deductions and cannot be negative.
- No automatic tax, attendance deductions, leave deductions, or bank payment.
- Period is a year-month value, not a timestamp.
- Only one draft and one published/current statement per employee and period.
- Published financial values, employee/company snapshots, and PDF template version are immutable.
- To correct a published slip, CEO voids it with a reason and creates a new revision.
- Each revision has its own immutable ID and revision number. A voided statement remains visible to its owner with a prominent VOID label.
- CEO can publish for an inactive former employee when legally appropriate, but deactivated employees cannot log in. External delivery then requires a separately authorized process.
- Employees never see drafts or another employee's statements.
- PDFs are generated on demand after authorization, with private no-store responses. No public file URLs.

### Publication readiness

Currency, required company metadata, and jurisdiction-specific fields must be reviewed before publication is enabled. A PDF in this system does not replace professional payroll/legal review.
