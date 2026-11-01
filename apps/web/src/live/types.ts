export interface Page { page: number; limit: number; total: number }
export interface Reply<T> { data: T; pagination?: Page }
export interface RecordBase { id: string; version: number; createdAt: string; updatedAt: string }
export interface Employee extends RecordBase {
  userId: string; employeeCode: string; fullName: string; email: string; jobTitle: string; department: string;
  startDate: string; phone: string; employmentStatus: 'ACTIVE' | 'INACTIVE'; accountStatus: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  invitationDelivery: 'sent' | 'failed' | 'pending' | null; deactivationReason: string | null;
}
export interface Session {
  userId: string; role: 'CEO' | 'EMPLOYEE'; email: string; displayName: string; employee: Employee | null;
  enabledModules: string[]; expiresAt: string; absoluteExpiresAt: string;
}
export interface Company {
  displayName: string; legalName: string; statementAddress: string; timezone: string; workingWeekdays: number[];
  currencyCode: string; currencyMinorUnit: number; leaveTypes: string[]; salaryPublicationEnabled: boolean;
  salaryJurisdiction: string; version: number;
}
export interface Attendance extends RecordBase {
  employeeId: string; workDate: string; checkInAt: string; checkOutAt: string | null; state: 'OPEN' | 'CLOSED';
  nonWorkingDayFlag: boolean; approvedLeaveFlag: boolean; currentApprovedLeaveOverlap: boolean; durationSeconds: number | null;
  corrections?: Reply<{ id: string; reason: string; createdAt: string; beforeValues: {checkInAt: string; checkOutAt: string | null}; afterValues: {checkInAt: string; checkOutAt: string | null} }[]>;
}
export interface CurrentAttendance { openRecord: Attendance | null; todayRecord: Attendance | null; nextAction: string }
export interface Leave extends RecordBase {
  employeeId: string; type: string; startDate: string; endDate: string; workingDatesSnapshot: string[]; dayCount: number;
  reason: string; state: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; decisionReason: string | null;
  history?: {id: string; fromState: string | null; toState: string; reason: string | null; createdAt: string}[];
}
export interface Task extends RecordBase {
  title: string; description: string; assigneeEmployeeId: string; assigneeName: string; priority: string;
  state: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'; dueDate: string | null;
}
export interface Complaint extends RecordBase {
  employeeId: string; subject: string; category: string; description?: string;
  state: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
}
export interface Message { id: string; authorUserId: string; text: string; messageType: string; createdAt: string }
export interface Holiday extends RecordBase { date: string; name: string; note: string }
export interface Impact {
  impactFingerprint: string; affectedDates: string[]; affectedCount: number; truncated: boolean;
  affectedRequests: {id: string; employeeId: string; state: string; startDate: string; endDate: string; dayCount: number}[];
}
export interface SalaryLine { label: string; amountMinor: number }
export interface Salary extends RecordBase {
  employeeId: string; period: string; revision: number; state: 'DRAFT' | 'PUBLISHED' | 'VOIDED'; currencyCode: string;
  currencyMinorUnit: number; earnings: SalaryLine[]; deductions: SalaryLine[]; grossMinor: number; totalDeductionsMinor: number;
  netMinor: number; note: string; voidReason: string | null;
  employeeSnapshot: {fullName: string; employeeCode: string; jobTitle: string; department: string} | null;
  companySnapshot: {displayName: string; legalName: string; statementAddress: string; jurisdiction: string} | null;
}
export interface Audit { id: string; action: string; module: string; entityId: string | null; reason: string | null; createdAt: string; requestId: string }
