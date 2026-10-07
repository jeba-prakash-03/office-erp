import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Building2,
  Building,
  Target,
  Briefcase,
  CheckSquare,
  Clock,
  CalendarCheck,
  CreditCard,
  DollarSign,
  TrendingUp,
  FileText,
  FolderOpen,
  BarChart3,
  ShieldCheck,
  Settings,
  X,
  UserCheck,
  Receipt,
  PiggyBank,
  History,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, hasPermission } = useAuth();

  const isSuperAdmin = user?.roleName === 'super_admin' || user?.role === 'super_admin';
  const isAdmin = isSuperAdmin || user?.roleName === 'admin' || user?.role === 'admin';
  const isEmployee = user?.roleName === 'employee' || user?.role === 'employee';

  const navGroups = isEmployee
    ? [
        {
          title: 'MY WORKSPACE',
          items: [
            { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
            { name: 'My Attendance', path: '/my-attendance', icon: Clock },
            { name: 'My Leave', path: '/leave', icon: CalendarCheck },
            { name: 'My Tasks', path: '/tasks', icon: CheckSquare },
            { name: 'My Projects', path: '/projects', icon: Briefcase },
            { name: 'My Timesheets', path: '/timesheets', icon: Clock },
            { name: 'My Payslips', path: '/payroll', icon: CreditCard },
            { name: 'My Performance', path: '/performance', icon: TrendingUp },
            { name: 'Documents', path: '/documents', icon: FolderOpen },
          ],
        },
      ]
    : [
        {
          title: 'MAIN',
          items: [{ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }],
        },
        {
          title: 'PEOPLE',
          items: [
            { name: 'Employees', path: '/employees', icon: Users, show: hasPermission('employees.view') },
            { name: 'Departments', path: '/departments', icon: Building2, show: hasPermission('departments.view') },
            { name: 'Attendance Sheet', path: '/attendance', icon: UserCheck, show: hasPermission('attendance.view') },
            { name: 'Leave Management', path: '/leave', icon: CalendarCheck, show: hasPermission('leave.view') },
            { name: 'Performance', path: '/performance', icon: TrendingUp, show: hasPermission('performance.view') },
          ].filter((i) => i.show !== false),
        },
        {
          title: 'WORK',
          items: [
            { name: 'Projects', path: '/projects', icon: Briefcase, show: hasPermission('projects.view') },
            { name: 'Tasks', path: '/tasks', icon: CheckSquare, show: hasPermission('tasks.view') },
            { name: 'Timesheets', path: '/timesheets', icon: Clock, show: hasPermission('timesheets.view') || hasPermission('timesheets.log') },
          ].filter((i) => i.show !== false),
        },
        {
          title: 'CRM',
          items: [
            { name: 'Clients', path: '/clients', icon: Building, show: hasPermission('clients.view') },
            { name: 'Leads', path: '/leads', icon: Target, show: hasPermission('leads.view') },
          ].filter((i) => i.show !== false),
        },
        {
          title: 'FINANCE',
          items: [
            { name: 'Finance Overview', path: '/finance', icon: DollarSign, show: hasPermission('finance.view') },
            { name: 'Invoices', path: '/invoices', icon: FileText, show: hasPermission('invoices.manage') },
            { name: 'Payments', path: '/payments', icon: Receipt, show: hasPermission('payments.manage') },
            { name: 'Payroll Engine', path: '/payroll', icon: CreditCard, show: hasPermission('payroll.view') },
          ].filter((i) => i.show !== false),
        },
        {
          title: 'INSIGHTS & DOCS',
          items: [
            { name: 'Reports', path: '/reports', icon: BarChart3, show: hasPermission('reports.view') },
            { name: 'Documents', path: '/documents', icon: FolderOpen, show: hasPermission('documents.view') },
          ].filter((i) => i.show !== false),
        },
        {
          title: 'ADMINISTRATION',
          items: [
            { name: 'Users', path: '/users', icon: Users, show: isAdmin },
            { name: 'Roles & Permissions', path: '/roles', icon: ShieldCheck, show: isSuperAdmin },
            { name: 'Settings', path: '/settings', icon: Settings, show: isAdmin },
            { name: 'Audit Logs', path: '/audit', icon: History, show: isAdmin },
          ].filter((i) => i.show !== false),
        },
        ...(isSuperAdmin
          ? [
              {
                title: 'SUPER ADMIN ONLY',
                items: [
                  { name: 'Investments', path: '/investments', icon: PiggyBank },
                ],
              },
            ]
          : []),
      ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={clsx(
          'fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              O
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                OfficeERP
              </span>
              <span className="block text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400 tracking-wider">
                Enterprise v2
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Role Badge */}
        <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email}
              </p>
              <span
                className={clsx(
                  'inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase',
                  isSuperAdmin
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    : isAdmin
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                )}
              >
                {user?.roleDisplayName || (isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Employee')}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <h3 className="px-3 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                {group.title}
              </h3>
              <div className="mt-1.5 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                      }}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                        )
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* System Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 text-center">
          OfficeERP &copy; 2026
        </div>
      </aside>
    </>
  );
};
