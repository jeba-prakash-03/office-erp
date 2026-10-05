import React from 'react';
import { NavLink, Link } from 'react-router-dom';
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
  Package,
  FolderOpen,
  Megaphone,
  Video,
  Calendar,
  BarChart3,
  ShieldCheck,
  Sliders,
  X,
  UserCheck,
  Receipt,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, hasPermission, hasRole } = useAuth();

  const isClient = user?.roleName === 'client';
  const isEmployeeOnly = user?.roleName === 'employee';

  const navGroups = [
    {
      title: 'Main',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, show: true },
        { name: 'Client Portal', path: '/portal/client', icon: Building, show: isClient },
        { name: 'Employee Portal', path: '/portal/employee', icon: UserCheck, show: isEmployeeOnly },
      ],
    },
    {
      title: 'Human Resources',
      show: !isClient && (hasPermission('employees.view') || hasPermission('attendance.view') || hasPermission('leave.view') || hasPermission('payroll.view')),
      items: [
        { name: 'Employees', path: '/employees', icon: Users, show: hasPermission('employees.view') },
        { name: 'Departments', path: '/departments', icon: Building2, show: hasPermission('departments.view') },
        { name: 'Attendance', path: '/attendance', icon: Clock, show: hasPermission('attendance.view') },
        { name: 'Leave Management', path: '/leave', icon: CalendarCheck, show: hasPermission('leave.view') },
        { name: 'Payroll / Salary', path: '/payroll', icon: CreditCard, show: hasPermission('payroll.view') },
        { name: 'Loans & Advances', path: '/loans', icon: DollarSign, show: true },
        { name: 'Performance', path: '/performance', icon: TrendingUp, show: hasPermission('performance.view') },
      ],
    },
    {
      title: 'Work & Projects',
      show: !isClient,
      items: [
        { name: 'Projects', path: '/projects', icon: Briefcase, show: hasPermission('projects.view') },
        { name: 'Tasks & Kanban', path: '/tasks', icon: CheckSquare, show: hasPermission('tasks.view') },
        { name: 'Timesheets', path: '/timesheets', icon: Clock, show: true },
      ],
    },
    {
      title: 'Sales & CRM',
      show: !isClient && (hasPermission('clients.view') || hasPermission('leads.view')),
      items: [
        { name: 'Clients', path: '/clients', icon: Building, show: hasPermission('clients.view') },
        { name: 'Leads Pipeline', path: '/leads', icon: Target, show: hasPermission('leads.view') },
      ],
    },
    {
      title: 'Finance & Billing',
      show: !isClient && (hasPermission('finance.view') || hasPermission('invoices.manage') || hasPermission('payments.manage')),
      items: [
        { name: 'Company Finance', path: '/finance', icon: DollarSign, show: hasPermission('finance.view') },
        { name: 'Invoices', path: '/invoices', icon: FileText, show: hasPermission('invoices.manage') },
        { name: 'Payments', path: '/payments', icon: Receipt, show: hasPermission('payments.manage') },
      ],
    },
    {
      title: 'Operations',
      items: [
        { name: 'Assets Inventory', path: '/assets', icon: Package, show: !isClient && hasPermission('assets.view') },
        { name: 'Document Vault', path: '/documents', icon: FolderOpen, show: true },
        { name: 'Announcements', path: '/announcements', icon: Megaphone, show: true },
        { name: 'Meetings', path: '/meetings', icon: Video, show: true },
        { name: 'Calendar', path: '/calendar', icon: Calendar, show: true },
      ],
    },
    {
      title: 'Analytics & Administration',
      show: !isClient && (hasPermission('reports.view') || hasPermission('settings.manage') || hasPermission('roles.manage')),
      items: [
        { name: 'Reports & Export', path: '/reports', icon: BarChart3, show: hasPermission('reports.view') },
        { name: 'Audit Logs', path: '/audit-logs', icon: ShieldCheck, show: hasPermission('audit_logs.view') },
        { name: 'Roles & Access', path: '/roles', icon: Users, show: hasPermission('roles.manage') },
        { name: 'Users Roster', path: '/users', icon: UserCheck, show: hasPermission('users.view') },
        { name: 'Company Settings', path: '/settings', icon: Sliders, show: hasPermission('settings.manage') },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={clsx(
          'fixed top-0 left-0 bottom-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800 lg:translate-x-0 lg:static',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-black text-base shadow-md shadow-brand-500/20">
              E
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight leading-none block">
                Office<span className="text-brand-400">ERP</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mt-0.5">
                Enterprise Suite
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups
            .filter((g) => g.show !== false)
            .map((group, gIdx) => {
              const visibleItems = group.items.filter((item) => item.show !== false);
              if (visibleItems.length === 0) return null;

              return (
                <div key={gIdx}>
                  <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {group.title}
                  </div>
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
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
                              'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group',
                              isActive
                                ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                            )
                          }
                        >
                          <Icon className="w-4 h-4 flex-shrink-0 transition group-hover:scale-110" />
                          <span className="truncate">{item.name}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer User Info */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/30 text-xs">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <div className="truncate text-slate-400">
              Connected to <span className="text-slate-200 font-semibold">MySQL 8.0</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
