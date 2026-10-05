# Office Management / Enterprise Company ERP System

A production-ready, full-stack Enterprise Resource Planning (ERP) and Office Management application engineered with **React 18 + TypeScript + Vite + Tailwind CSS** frontend, **Node.js + Express + TypeScript** REST backend, and **MySQL 8** relational database.

---

## 🌟 System Highlights & Features

- 🔐 **Authentication & Enterprise RBAC**: Multi-role support (`super_admin`, `admin`, `hr_manager`, `project_manager`, `accountant`, `employee`, `client`), dynamic granular permissions (50+ permissions), JWT authentication with access + refresh token rotation, bcrypt password hashing, and brute-force rate limiting.
- 🏢 **Multi-tier HR & Staff Directory**: Complete employee profiles, personal details, bank details, emergency contacts, statutory identity (PAN, Aadhaar/SSN, Passport), salary structures, department hierarchies, designations, and document vault.
- ⏱️ **Attendance, Bio-punch & Timesheets**: Real-time punch in / punch out, IP & geolocation verification, automatic duration & overtime tracking, late arrival flags, attendance correction requests with multi-level approval workflows, and weekly timesheets with project hour logging.
- 🏖️ **Leave Management System**: Annual, Sick, Casual, Maternity, Paternity, and Unpaid leave types, automated leave balance tracking, employee leave applications, supervisor approval/rejection workflows with comment audits.
- 💰 **Payroll, Salary Processing & Payslips**: Multi-component salary structures (Basic, HRA, Medical, Conveyance, Special Allowance, PF, Tax/TDS, ESI, Custom Deductions), automated net pay calculation, monthly bulk payroll processing, payslip PDF generation/download, and employee loan/advance management.
- 📈 **Performance & Appraisal Engine**: Periodic KPI evaluation cycles, multi-criteria ratings (technical, productivity, communication, teamwork, punctuality), reviewer feedback, strengths, improvement plans, and self/manager reviews.
- 📁 **CRM & Client Management**: Client profiles, contacts, contract documents, sales lead pipeline (qualification, proposal, negotiation, won/lost), and dedicated secure Client Portal.
- 🚀 **Projects & Agile Kanban Sprints**: Project milestone tracking, budget allocation, team assignments, Kanban board with drag-and-drop task progression, checklists, task attachments, time logging, and priority tags.
- 💵 **Finance, Invoices & Double-entry Accounting**: Income and expense tracking with category breakdowns, billable invoice generator with automatic line item tax calculation, client payment recording, balance tracking, and financial statements.
- 💻 **Asset & Inventory Lifecycle**: Hardware/equipment tracking, serial numbers, warranty expiry alerts, custody assignment history, asset condition, and repair logs.
- 📄 **Secure Document Vault**: Organization-wide documents, department-restricted policies, NDA/contract storage, version tracking, and employee profile document uploads.
- 📢 **Company Operations & Collaboration**: Organization announcements with priority pinning, team meetings with attendee invites & video conference links, global company holiday calendar, and full-text global search across all entities.
- 📊 **Executive Analytics & PDF/Excel Exports**: Real-time interactive revenue/expense charts, attendance distribution graphs, project status rings, departmental headcount analytics, and exportable reports in PDF and CSV format.
- 🛡️ **Comprehensive Audit Logging**: Immutable audit logs capturing IP address, user agent, action type, affected entity, before/after JSON payloads for compliance.

---

## 🏗️ Architecture & Technology Stack

```
office-ERP/
├── backend/                  # Node.js + Express + TypeScript REST API
│   ├── src/
│   │   ├── config/           # Database connection & environment configuration
│   │   ├── controllers/      # 27 modular business logic controllers
│   │   ├── database/         # Database migrations & initial seeders
│   │   ├── middleware/       # Auth, RBAC, File Upload, Error Handler, Audit
│   │   ├── routes/           # REST API Route definitions
│   │   ├── types/            # TypeScript request/response & database interfaces
│   │   ├── utils/            # JWT, password hashing, audit logger, helpers
│   │   └── index.ts          # Express application entry point
│   ├── uploads/              # Local uploaded files, receipts, avatars, documents
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/                 # React 18 + TypeScript + Vite + Tailwind CSS SPA
    ├── src/
    │   ├── api/              # Axios HTTP client & comprehensive API service layer
    │   ├── components/       # Reusable UI primitives (DataTable, Modal, StatsCard, etc.)
    │   ├── context/          # AuthContext, ThemeContext, NotificationContext
    │   ├── pages/            # 25+ Functional domain pages & portals
    │   ├── types/            # Strict TypeScript interface declarations
    │   ├── App.tsx           # React Router route registry
    │   └── main.tsx          # Application bootstrapper
    ├── package.json
    ├── tailwind.config.js
    └── tsconfig.json
```

---

## ⚡ Quick Start & Setup

### 1. Prerequisites
- **Node.js**: v18.0+ or v20+
- **MySQL**: 8.0+
- **npm** or **yarn**

### 2. Database Configuration
Ensure MySQL is running. Create the database:
```sql
CREATE DATABASE IF NOT EXISTS office_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Backend Setup
```bash
cd backend
npm install
```

Configure your environment in `backend/.env`:
```env
PORT=5000
NODE_ENV=development

# MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=office_erp
DB_CONNECTION_LIMIT=20

# JWT Authentication
JWT_SECRET=super_secret_jwt_key_office_erp_2025_secure
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=super_secret_refresh_jwt_key_office_erp_2025_secure
JWT_REFRESH_EXPIRES_IN=7d

# Frontend CORS
FRONTEND_URL=http://localhost:5173
```

Run database migrations and initial seeder:
```bash
# Run 45-table schema migrations
npm run migrate

# Seed initial roles, permissions, leave types, categories, and Super Admin
npm run seed

# Start backend dev server
npm run dev
```
Backend will be active at: **`http://localhost:5000`**

### 4. Frontend Setup
```bash
cd ../frontend
npm install

# Start frontend dev server
npm run dev
```
Frontend will be active at: **`http://localhost:5173`**

---

## 🔑 Initial System Credentials

| Role | Email | Password | Scope |
|---|---|---|---|
| **Super Admin** | `admin@erp.local` | `Admin@123456` | Full administrative control across all modules, settings, users, and audit logs |

*Note: You can create additional staff members, HR managers, accountants, project managers, and clients via the Employee & User Management interfaces.*

---

## 🔒 Security & Best Practices

- **Zero Hardcoded Secrets**: All configuration values loaded dynamically from environment variables.
- **SQL Injection Defense**: 100% parameterized SQL queries via MySQL2 connection pool.
- **XSS & Headers Security**: Helmet HTTP security headers and sanitized payloads.
- **Password Protection**: Salted bcrypt password hashing with 10 rounds.
- **Audit Logs**: Every mutation (CREATE, UPDATE, DELETE, STATUS CHANGE) is recorded with IP and timestamp.
- **No Mock Data**: All views, charts, cards, and tables are wired to live database endpoints.

---

## 📄 License
This Enterprise ERP System is proprietary software designed for internal company management. All rights reserved.
# office-erp
