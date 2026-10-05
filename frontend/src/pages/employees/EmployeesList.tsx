import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { employeesApi, departmentsApi, companyApi } from '../../api/services';
import { Employee, Department, CompanySettings } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatsCard } from '../../components/ui/StatsCard';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmployeeModal } from './EmployeeModal';
import { formatCurrency, formatDate, getInitials } from '../../utils/formatters';
import { 
  Plus, Eye, Edit2, Trash2, Filter, Users, UserCheck, 
  Calendar, UserPlus, X, Search, Building2, Phone, Mail, 
  DollarSign, Briefcase 
} from 'lucide-react';

export const EmployeesList: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [stats, setStats] = useState<{ total: number; active: number; onLeave: number; newThisMonth: number }>({
    total: 0,
    active: 0,
    onLeave: 0,
    newThisMonth: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const { showToast } = useNotifications();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch initial company settings & departments
  useEffect(() => {
    Promise.all([
      companyApi.getSettings().catch(() => ({ data: { data: null } })),
      departmentsApi.list().catch(() => ({ data: { data: [] } })),
      employeesApi.getStats().catch(() => ({ data: { data: { total: 0, active: 0, onLeave: 0, newThisMonth: 0 } } })),
    ]).then(([compRes, deptRes, statsRes]) => {
      if (compRes.data?.data) setCompanySettings(compRes.data.data);
      if (deptRes.data?.data) setDepartments(deptRes.data.data);
      if (statsRes.data?.data) setStats(statsRes.data.data);
    });
  }, []);

  // Fetch employee stats
  const fetchStats = async () => {
    try {
      const res = await employeesApi.getStats();
      if (res.data?.data) {
        setStats(res.data.data);
      }
    } catch {
      // Ignore stats error
    }
  };

  // Main fetch employees query
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await employeesApi.list({
        page,
        limit: 10,
        search: debouncedSearch || undefined,
        departmentId: deptFilter || undefined,
        employmentStatus: statusFilter || undefined,
        employmentType: employmentTypeFilter || undefined,
      });

      if (res.data?.success) {
        setEmployees(res.data.data || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotal(res.data.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to connect to employee database server.');
      showToast('Failed to load employees roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [page, debouncedSearch, deptFilter, statusFilter, employmentTypeFilter]);

  const handleCreateOrUpdate = async (formData: any) => {
    setModalLoading(true);
    try {
      if (editingEmployee) {
        await employeesApi.update(editingEmployee.id, formData);
        showToast('Employee profile updated successfully', 'success');
      } else {
        await employeesApi.create(formData);
        showToast('Employee created with automated leave quotas & salary structure', 'success');
      }
      setShowCreateModal(false);
      setEditingEmployee(null);
      fetchEmployees();
      fetchStats();
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Operation failed', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEmployee) return;
    setModalLoading(true);
    try {
      await employeesApi.delete(deletingEmployee.id);
      showToast('Employee deactivated and user account suspended', 'success');
      setDeletingEmployee(null);
      fetchEmployees();
      fetchStats();
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Failed to deactivate employee', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const hasActiveFilters = Boolean(search || deptFilter || statusFilter || employmentTypeFilter);

  const clearAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setDeptFilter('');
    setStatusFilter('');
    setEmploymentTypeFilter('');
    setPage(1);
  };

  const selectedDeptName = useMemo(() => {
    if (!deptFilter) return '';
    const d = departments.find((dept) => String(dept.id) === String(deptFilter) || dept.name === deptFilter);
    return d ? d.name : deptFilter;
  }, [deptFilter, departments]);

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (emp) => {
        const initials = getInitials(emp.first_name, emp.last_name);
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
              {emp.profile_photo ? (
                <img src={emp.profile_photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div>
              <Link
                to={`/employees/${emp.id}`}
                className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block text-sm"
              >
                {emp.first_name} {emp.last_name}
              </Link>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span>{emp.employee_id}</span>
                {emp.reporting_manager_name && (
                  <span className="text-[11px] text-slate-400">
                    • Rep: {emp.reporting_manager_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'department',
      header: 'Role & Department',
      render: (emp) => (
        <div>
          <div className="font-medium text-slate-800 dark:text-slate-200 text-xs">
            {emp.designation || 'Staff'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
            <Building2 className="w-3 h-3 text-slate-400" />
            <span>{emp.department_name || <span className="italic text-slate-400">Unassigned</span>}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      render: (emp) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate max-w-[150px]">{emp.email}</span>
          </div>
          {emp.phone && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{emp.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'employment_status',
      header: 'Status',
      render: (emp) => <StatusBadge status={emp.employment_status || 'active'} />,
    },
    {
      key: 'basic_salary',
      header: 'Base Salary',
      render: (emp) => (
        <span className="font-semibold text-xs text-slate-900 dark:text-white">
          {formatCurrency(
            emp.basic_salary,
            companySettings?.currency || 'INR',
            companySettings?.currency_symbol || '₹'
          )}
        </span>
      ),
    },
    {
      key: 'joining_date',
      header: 'Joined Date',
      render: (emp) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {formatDate(emp.joining_date)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (emp) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => navigate(`/employees/${emp.id}`)}
            title="View Full Profile"
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          {hasPermission('employees.edit') && (
            <button
              onClick={() => {
                setEditingEmployee(emp);
                setShowCreateModal(true);
              }}
              title="Edit Employee"
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {hasPermission('employees.delete') && (
            <button
              onClick={() => setDeletingEmployee(emp)}
              title="Deactivate Employee"
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Employees"
        subtitle="Employee directory, HR information and workforce management"
        action={
          hasPermission('employees.create') && (
            <button
              onClick={() => {
                setEditingEmployee(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          )
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard
          title="Total Workforce"
          value={stats.total.toString()}
          icon={<Users className="w-5 h-5 text-indigo-500" />}
        />
        <StatsCard
          title="Active Employees"
          value={stats.active.toString()}
          icon={<UserCheck className="w-5 h-5 text-emerald-500" />}
        />
        <StatsCard
          title="On Leave Today"
          value={stats.onLeave.toString()}
          icon={<Calendar className="w-5 h-5 text-amber-500" />}
        />
        <StatsCard
          title="Joined This Month"
          value={stats.newThisMonth.toString()}
          icon={<UserPlus className="w-5 h-5 text-blue-500" />}
        />
      </div>

      {/* Professional Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees by name, email, ID..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            <select
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="notice_period">Notice Period</option>
              <option value="terminated">Terminated</option>
            </select>

            <select
              value={employmentTypeFilter}
              onChange={(e) => {
                setEmploymentTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Types</option>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-400">Active filters:</span>
            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-700 dark:text-indigo-300">
                Search: “{debouncedSearch}”
                <button onClick={() => setSearch('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {deptFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-700 dark:text-indigo-300">
                Dept: {selectedDeptName}
                <button onClick={() => setDeptFilter('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {statusFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-700 dark:text-indigo-300">
                Status: {statusFilter.replace('_', ' ')}
                <button onClick={() => setStatusFilter('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {employmentTypeFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-700 dark:text-indigo-300">
                Type: {employmentTypeFilter.replace('_', ' ')}
                <button onClick={() => setEmploymentTypeFilter('')}><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Employee Table */}
      <DataTable
        columns={columns}
        data={employees}
        loading={loading}
        error={error}
        onRetry={fetchEmployees}
        emptyTitle={
          hasActiveFilters
            ? 'No employees match your filters'
            : 'No employees in your organization yet'
        }
        emptyDescription={
          hasActiveFilters
            ? 'Try changing or clearing your department, status, or search query.'
            : 'Add your first employee to start building your company workforce directory.'
        }
        emptyAction={
          hasActiveFilters ? (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
            >
              Clear Filters
            </button>
          ) : hasPermission('employees.create') ? (
            <button
              onClick={() => {
                setEditingEmployee(null);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          ) : undefined
        }
        pagination={{
          page,
          limit: 10,
          total,
          totalPages,
          onPageChange: setPage,
        }}
      />

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <EmployeeModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingEmployee(null);
          }}
          onSubmit={handleCreateOrUpdate}
          initialData={editingEmployee}
          loading={modalLoading}
          currencySymbol={companySettings?.currency_symbol || '₹'}
        />
      )}

      {/* Confirm Deletion / Deactivation */}
      {deletingEmployee && (
        <ConfirmDialog
          isOpen={!!deletingEmployee}
          onClose={() => setDeletingEmployee(null)}
          onConfirm={handleDelete}
          title="Deactivate Employee Profile"
          message={`Are you sure you want to deactivate ${deletingEmployee.first_name} ${deletingEmployee.last_name}? Their associated user account will be deactivated and status marked as terminated.`}
          confirmText="Deactivate Employee"
          isDestructive
          loading={modalLoading}
        />
      )}
    </div>
  );
};

