import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoadingState } from './components/ui/LoadingState';

// Auth Pages
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';

// Main Application Pages
import { Dashboard } from './pages/dashboard/Dashboard';
import { EmployeesList } from './pages/employees/EmployeesList';
import { EmployeeDetails } from './pages/employees/EmployeeDetails';
import { DepartmentsList } from './pages/departments/DepartmentsList';
import { ClientsList } from './pages/clients/ClientsList';
import { ClientDetails } from './pages/clients/ClientDetails';
import { LeadsList } from './pages/leads/LeadsList';
import { ProjectsList } from './pages/projects/ProjectsList';
import { ProjectDetails } from './pages/projects/ProjectDetails';
import { TasksList } from './pages/tasks/TasksList';
import { TaskKanban } from './pages/tasks/TaskKanban';
import { AttendanceList } from './pages/attendance/AttendanceList';
import { MyAttendancePage } from './pages/attendance/MyAttendancePage';
import { LeaveList } from './pages/leave/LeaveList';
import { ApprovalsHub } from './pages/approvals/ApprovalsHub';


import { PayrollList } from './pages/payroll/PayrollList';
import { PayslipView } from './pages/payroll/PayslipView';
import { LoansList } from './pages/loans/LoansList';
import { PerformanceList } from './pages/performance/PerformanceList';
import { TimesheetsList } from './pages/timesheets/TimesheetsList';
import { FinanceList } from './pages/finance/FinanceList';
import { InvoicesList } from './pages/invoices/InvoicesList';
import { InvoiceDetails } from './pages/invoices/InvoiceDetails';
import { PaymentsList } from './pages/payments/PaymentsList';
import { AssetsList } from './pages/assets/AssetsList';
import { DocumentsList } from './pages/documents/DocumentsList';
import { AnnouncementsList } from './pages/announcements/AnnouncementsList';
import { MeetingsList } from './pages/meetings/MeetingsList';
import { CalendarView } from './pages/calendar/CalendarView';
import { ReportsView } from './pages/reports/ReportsView';
import { AuditLogsList } from './pages/audit/AuditLogsList';
import { RolesList } from './pages/roles/RolesList';
import { UsersList } from './pages/users/UsersList';
import { SettingsView } from './pages/settings/SettingsView';
import { ProfileView } from './pages/profile/ProfileView';
import { ClientPortal } from './pages/portal/ClientPortal';
import { EmployeePortal } from './pages/portal/EmployeePortal';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode; permission?: string; role?: string }> = ({
  children,
  permission,
  role,
}) => {
  const { isAuthenticated, loading, hasPermission, user } = useAuth();

  if (loading) {
    return <LoadingState text="Authenticating session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900 my-8">
        <h2 className="text-lg font-bold text-red-600 mb-1">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          You do not have the required permission (<code>{permission}</code>) to view this module.
        </p>
      </div>
    );
  }

  if (role && user?.role !== role && user?.role !== 'super_admin') {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900 my-8">
        <h2 className="text-lg font-bold text-red-600 mb-1">Access Restricted</h2>
        <p className="text-xs text-slate-500">This module is reserved for {role} accounts.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Authenticated Dashboard & Core ERP Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="approvals" element={<ApprovalsHub />} />

        {/* HR & Personnel */}
        <Route path="employees" element={<EmployeesList />} />
        <Route path="employees/:id" element={<EmployeeDetails />} />
        <Route path="departments" element={<DepartmentsList />} />

        {/* CRM & Clients */}
        <Route path="clients" element={<ClientsList />} />
        <Route path="clients/:id" element={<ClientDetails />} />
        <Route path="leads" element={<LeadsList />} />

        {/* Projects & Sprints */}
        <Route path="projects" element={<ProjectsList />} />
        <Route path="projects/:id" element={<ProjectDetails />} />
        <Route path="tasks" element={<TasksList />} />
        <Route path="tasks/kanban" element={<TaskKanban />} />

        {/* Time & Attendance */}
        <Route path="my-attendance" element={<MyAttendancePage />} />
        <Route path="attendance" element={<AttendanceList />} />
        <Route path="leave" element={<LeaveList />} />
        <Route path="timesheets" element={<TimesheetsList />} />


        {/* Payroll & Disbursal */}
        <Route path="payroll" element={<PayrollList />} />
        <Route path="payroll/payslip/:id" element={<PayslipView />} />
        <Route path="loans" element={<LoansList />} />
        <Route path="performance" element={<PerformanceList />} />

        {/* Finance & Invoicing */}
        <Route path="finance" element={<FinanceList />} />
        <Route path="invoices" element={<InvoicesList />} />
        <Route path="invoices/:id" element={<InvoiceDetails />} />
        <Route path="payments" element={<PaymentsList />} />

        {/* Assets & Knowledge */}
        <Route path="assets" element={<AssetsList />} />
        <Route path="documents" element={<DocumentsList />} />
        <Route path="announcements" element={<AnnouncementsList />} />
        <Route path="meetings" element={<MeetingsList />} />
        <Route path="calendar" element={<CalendarView />} />

        {/* Analytics & Security */}
        <Route path="reports" element={<ReportsView />} />
        <Route path="audit" element={<AuditLogsList />} />
        <Route path="roles" element={<RolesList />} />
        <Route path="users" element={<UsersList />} />
        <Route path="settings" element={<SettingsView />} />
        <Route path="profile" element={<ProfileView />} />

        {/* Portals */}
        <Route path="portal/client" element={<ClientPortal />} />
        <Route path="portal/employee" element={<EmployeePortal />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
