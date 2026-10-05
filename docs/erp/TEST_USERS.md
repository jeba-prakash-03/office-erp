# Office ERP — Test Users & Role Matrix Documentation

**Environment**: Local Development & QA  
**Default Password (All Accounts)**: `Admin@123456`

---

## 1. Seeded Multi-Role Accounts

| Role | Email | Name | Employee Code | Department | Key Responsibilities & Access Scope |
|---|---|---|---|---|---|
| **Super Admin** | `admin@erp.local` | Super Administrator | `EMP-0001` | Engineering | Full system authority, global settings, audit logs, unrestricted access across all modules. |
| **Admin** | `executive.admin@erp.local` | Operations Director | `EMP-0002` | Engineering | Executive administration, company overview, role management, broad operational governance. |
| **HR Manager** | `hr.manager@erp.local` | Priya Sharma | `EMP-0003` | Human Resources | Employee directory, onboarding, department configurations, leave approvals, payroll preparations. |
| **Finance Manager** | `finance.manager@erp.local` | Rajesh Verma | `EMP-0004` | Finance & Accounts | Financial ledger, client invoices, payment approvals, payroll sign-off and disbursals. |
| **Project Manager** | `pm.lead@erp.local` | Karthik Subramanian | `EMP-0005` | Engineering | Project scoping, milestone delivery, task assignments, timesheet approvals. *(Manager of EMP-0007)*. |
| **Team Lead** | `team.lead@erp.local` | Ananya Iyer | `EMP-0006` | Engineering | Sprint execution, task review, peer timesheet reviews, team attendance tracking. |
| **Employee** | `developer.employee@erp.local` | Siddharth Patel | `EMP-0007` | Engineering | Self-service workspace ("My Work"), clock in/out, leave applications, task logging, payslip viewing. *(Reports to EMP-0005)*. |
| **Client** | `client.contact@acmecorp.test` | Acme Representative | *N/A (External Client)* | Client Portal | Client portal access isolated to Acme Corp's active project (`PRJ-ACME-001`) and invoice (`INV-2026-001`). |

---

## 2. Seeded Test Relationships & Test Data

### A. Manager / Report Pair
- **Manager**: `EMP-0005` (Karthik Subramanian, Project Manager)
- **Direct Report**: `EMP-0007` (Siddharth Patel, Software Engineer)
- **Verification Rule**: Leave applications submitted by `EMP-0007` route directly to `EMP-0005` or HR for approval. `EMP-0007` cannot approve their own leave.

### B. Client / Project / Invoice Linkage
- **Client**: `CLI-ACME-001` (Acme Global Enterprises, contact: `client.contact@acmecorp.test`)
- **Linked Project**: `PRJ-ACME-001` (Acme Enterprise Portal System, PM: `EMP-0005`, Budget: ₹25,00,000)
- **Linked Invoice**: `INV-2026-001` (Grand Total: ₹5,90,000, Paid: ₹2,00,000, Remaining Balance: ₹3,90,000)
- **Verification Rule**: Client login sees only `PRJ-ACME-001` and `INV-2026-001`, and cannot access internal employees or payroll.
