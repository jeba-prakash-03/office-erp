# Office ERP — Architectural & Business Decisions Log

This document records architectural, identity, authorization, and domain modeling decisions made during the OfficeERP overhaul.

---

## Decision Log

### DEC-001: Separation of User Identity and Employee Profile
- **Context**: In ERP systems, a system account (`users`) is not synonymous with an HR employee record (`employees`). A Super Admin or external Client has a login account but might not be an employee; conversely, an Employee has HR attributes (salary, leave balance, department, manager).
- **Decision**: 
  - Every authenticated request parses JWT token and resolves `{ userId, employeeId, clientId, roleId, roleName, permissions }`.
  - Self-service endpoints ("My Attendance", "Apply Leave", "My Timesheets", "My Payslips") strictly require `employeeId !== null`.
  - If an Admin or HR user is also an employee (e.g. `EMP-0001`), they have access to both their managerial modules and their personal "My Work" portal.
  - Client accounts have `clientId !== null` and are isolated to their own company's projects, tasks, and invoices.

---

### DEC-002: Canonical Business Timezone & Date Resolution
- **Context**: Server UTC time shifts dates (e.g. 11:30 PM in India is already the next day in UTC or vice versa), causing attendance and leave records to be saved under the wrong business date.
- **Decision**: 
  - Company timezone is stored in `company_settings.timezone` (default: `Asia/Kolkata`).
  - Business dates (`attendance.date`, `leave_requests.start_date`, `timesheets.date`, `invoices.invoice_date`) are evaluated in company timezone on the server using `getBusinessDate()`.
  - Wall-clock timestamps (`created_at`, `check_in`, `check_out`) are persisted as UTC/DATETIME in MySQL.
  - The client UI never decides business dates for backend transactions.

---

### DEC-003: Unified Approval Engine Architecture
- **Context**: Leave requests, attendance corrections, timesheets, expense claims, and loan applications all need multi-state approvals (Draft, Pending, Approved, Rejected, Cancelled). Writing bespoke approval columns across 6 different tables leads to inconsistent audit trails, missing rejection reasons, and notification failures.
- **Decision**: 
  - Implement a centralized `approval_requests` & `approval_history` engine.
  - Prevent self-approval (a manager cannot approve their own leave or expense).
  - Approver is dynamically resolved from reporting line (`employees.reporting_manager_id`) or required role permission (`leave.approve`, `timesheets.approve`, `expenses.approve`).
  - Every state transition triggers an audit log and exactly one notification to the requester.

---

### DEC-004: Standard Error Contract & Response Envelope
- **Context**: Inconsistent response payloads (`{ error: string }` vs `{ message: string }` vs raw stacks) prevent frontend components from displaying actionable errors.
- **Decision**: 
  - All backend endpoints return:
    - **Success**: `{ success: true, message?: string, data?: T, pagination?: PaginationInfo }`
    - **Failure**: `{ success: false, error: { code: string, message: string, details?: Record<string, string> } }`
  - HTTP Status Codes:
    - `200`: Success (Read / Update)
    - `201`: Created
    - `400`: Bad Request / Validation Failure
    - `401`: Unauthenticated (Missing/Expired JWT)
    - `403`: Forbidden (Lack of RBAC Permission or Scope)
    - `404`: Resource Not Found
    - `409`: Conflict / Duplicate Operation (e.g. Clock-in twice on same day)
    - `500`: Internal Server Error

---

### DEC-005: Toast Deduplication & Single-Mutation Invariant
- **Context**: React StrictMode and button double-clicks triggered multiple HTTP POST mutations, spamming the UI with stacked duplicate toast popups.
- **Decision**: 
  - Centralized notification toast deduplication in `NotificationContext`.
  - Mutating buttons (Clock In, Clock Out, Submit Leave, Log Timesheet, Process Payroll) must enter disabled/loading state immediately upon click (`if (loading) return`).
  - Safe GET requests may retry, but POST/PUT mutations are never retried automatically.

---

### DEC-006: Currency Formatting Standard
- **Context**: Application displayed `$` symbols despite company operating in India with INR base currency.
- **Decision**: 
  - Default currency is set to `INR` (`₹`) formatted with the Indian Numbering System (`en-IN`, e.g. `₹1,50,000.00`).
  - All monetary displays on Dashboard, Employees, Payroll, Invoices, Payments, and Expenses consume `formatCurrency()` from `utils/formatters.ts`.
