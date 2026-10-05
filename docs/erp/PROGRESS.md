# Office ERP — Implementation & Stage Progress Tracker

## Status Overview

| Stage | Title | Status | Verification & Artifacts |
|---|---|---|---|
| **Stage 0** | Codebase Audit & Defect Reproductions | **COMPLETED** | [`/docs/erp/AUDIT.md`](file:///home/jeba-prakash/Jeba/office-ERP/docs/erp/AUDIT.md), [`/docs/erp/DECISIONS.md`](file:///home/jeba-prakash/Jeba/office-ERP/docs/erp/DECISIONS.md) |
| **Stage 1** | Foundations (Identity, RBAC, Validation, Error Contract, Dates, Seed) | **COMPLETED** | [`/docs/erp/TEST_USERS.md`](file:///home/jeba-prakash/Jeba/office-ERP/docs/erp/TEST_USERS.md), `test_auth_me_matrix.ts` |
| **Stage 2** | Universal Approval Engine | **COMPLETED** | `approval.service.ts`, `test_approval_engine.ts` |
| **Stage 3** | Vertical Slices (Leave, Attendance, Timesheets, HR, Projects, Payroll, Finance, CRM) | **COMPLETED** | Slices 3.1 through 3.9 E2E Test Scripts |
| **Stage 4** | Build & Acceptance Testing | **COMPLETED** | Backend `tsc` exit 0, Frontend `vite build` exit 0 |

---

## Detailed Stage Checklist

### Stage 0: System Audit (COMPLETED)
- [x] Full repository inspection (backend routes, controllers, DB schema, frontend pages, state, formatters).
- [x] Module Inventory & Action Map documented in `AUDIT.md`.
- [x] Reproduce and document defects (DEF-001 through DEF-008).
- [x] Schema review (constraints, indices, naming standards).
- [x] Refactor roadmap and dependency graph finalized.

### Stage 1: Foundations (COMPLETED)
- [x] Authoritative `GET /api/auth/me` and `req.user` resolving `{ userId, employeeId, clientId, roleId, roleName, roles, permissions, companyId, departmentId }`.
- [x] Universal permission matrix (`permissions.ts`) with scope awareness (`own`, `team`, `department`, `all`).
- [x] Standardized error contract `{ success: false, error: { code, message, details } }` and Express error handler.
- [x] Self-service RBAC guards (`requireEmployeeProfile`) for personal portals.
- [x] Canonical company timezone (`Asia/Kolkata`) and date resolution on server.
- [x] Structured audit logging service (`logAudit`) with immutable table storage.
- [x] Comprehensive multi-role seed script (`seed.ts`) with 8 documented test accounts (`TEST_USERS.md`).

### Stage 2: Universal Approval Engine (COMPLETED)
- [x] MySQL schema migrations for `approval_requests` and `approval_history` audit tables.
- [x] Universal `ApprovalService` implementing state transitions (`pending`, `approved`, `rejected`, `cancelled`, `returned`).
- [x] Strict self-approval guard preventing employees/managers from approving their own submissions.
- [x] Direct reporting line and role-based approver resolution.
- [x] Automated requester notifications upon review decisions.
- [x] Verified via `test_approval_engine.ts` (100% pass).

### Stage 3: Vertical Slices (COMPLETED)
- [x] **Slice 3.1: Leave Module**
  - Balance reservation upon application (`pending_days` increment).
  - Self-approval guard returning 403 Forbidden.
  - Manager/HR approval updating used/remaining balances and auto-syncing attendance to 'leave'.
  - Leave cancellation reverting balances and deleting provisional attendance.
  - Verified via `test_leave_slice.ts`.
- [x] **Slice 3.2: Attendance Module (FULL PRODUCTION RESTRUCTURE)**
  - Clean separation into two dedicated experiences:
    1. **Employee Self-Service (`/my-attendance`)**: Single punch workflow (`[Clock In]` -> `[Clock Out]`), shift card with formatted durations (`8h 55m`), overtime formatted (`0h 00m`), and personal monthly history table.
    2. **HR/Admin Attendance Management (`/attendance`)**: Headcount & punch overview cards (Total, Present, Absent, Late, On Leave, Missing Punch), preset timeframe filters (Today, Yesterday, This Week, This Month, Custom), direct administrative manual correction with mandatory audit reason, and pending corrections review workflow.
  - Backend Date & Timezone: Company business date (`Asia/Kolkata`) strictly canonical; future dates rejected (`date > CURDATE()`).
  - Single-punch & duplicate submission protection (400 Bad Request on duplicate clock-in or clock-out).
  - Leave integration: approved leave reflects `ON_LEAVE` status only for current/past dates without generating future provisional rows.
  - Comprehensive 17-point test suite verified via `test_attendance_module_restructure.ts` and `test_attendance_slice.ts`.
- [x] **Slice 3.3: Timesheets Module**
  - Timesheet logging with project/task validation and hour bounds (0.1 - 24h).
  - Automatic task `actual_hours` accumulation.
  - PM approval routing with self-approval guard.
  - Client portal isolation (clients only see approved timesheets on their projects).
  - Verified via `test_timesheets_slice.ts`.
- [x] **Slice 3.4: HR / Employees / Departments**
  - Department management with active assignment constraints.
  - Employee creation with auto-linked user account, salary structure, and annual leave allocations.
  - Comprehensive employee profile fetching across all sub-tabs.
  - Soft deletion and user deactivation.
  - Verified via `test_hr_slice.ts`.
- [x] **Slice 3.5: Projects & Tasks**
  - Project creation with client linking, manager assignment, and team roster.
  - Task assignment with Kanban status lifecycle and checklist management.
  - Real-time audit logs and notification triggers.
  - Client portal verified view.
  - Verified via `test_projects_tasks_slice.ts`.
- [x] **Slice 3.6: Payroll & Loans**
  - Employee salary advance / loan applications with monthly EMI calculation.
  - Finance Manager review and approval.
  - Monthly payroll generation dynamically factoring basic salary, allowances, overtime, unpaid leave deductions, statutory PF/tax, and active loan EMIs.
  - Finance approval, salary expense recording, and isolated employee payslip views.
  - Verified via `test_payroll_loans_slice.ts`.
- [x] **Slice 3.7: Performance Reviews**
  - Standardized 1-5 scale ratings across 7 competencies with automatic overall score calculation.
  - Manager feedback submission with audit tracking.
  - Employee isolated viewing of reviews.
  - Verified via `test_performance_slice.ts`.
- [x] **Slice 3.8: Finance & Invoices**
  - Multi-item invoice generation with subtotal, discounts, GST/tax, and grand total calculations.
  - Payment recording with real-time balance reduction, status transitions (`draft` -> `partially_paid` -> `paid`), and excess payment protection.
  - Automated income ledger entry mirroring for accounting reconciliation.
  - Client portal invoice & receipt breakdown.
  - Verified via `test_finance_slice.ts`.
- [x] **Slice 3.9: CRM & Reports**
  - CRM leads pipeline (new -> proposal -> won).
  - Lead-to-client conversion with company & primary contact creation.
  - Role-scoped analytical reporting for all 10 domain entities (`employees`, `attendance`, `leave`, `payroll`, `projects`, `tasks`, `invoices`, `income`, `expenses`, `assets`).
  - Verified via `test_crm_reports_slice.ts`.

### Stage 4: Production Build & Health (COMPLETED)
- [x] Backend TypeScript build (`tsc`): 0 errors.
- [x] Frontend TypeScript and Vite bundle build (`tsc && vite build`): 0 errors in 9.54s.
- [x] Live backend server running on port 5000.
- [x] Live frontend dev server running on port 5173.

---

## Architectural Decisions Log
- Recorded in [`/docs/erp/DECISIONS.md`](file:///home/jeba-prakash/Jeba/office-ERP/docs/erp/DECISIONS.md).

## Test Users & Credentials
- Documented in [`/docs/erp/TEST_USERS.md`](file:///home/jeba-prakash/Jeba/office-ERP/docs/erp/TEST_USERS.md).
