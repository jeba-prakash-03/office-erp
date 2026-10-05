import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { employeesApi, departmentsApi } from '../../api/services';
import { Employee, Department } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmployeeModal } from './EmployeeModal';
import { Plus, Eye, Edit2, Trash2, Filter } from 'lucide-react';

export const EmployeesList: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const { showToast } = useNotifications();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await employeesApi.list({
        page,
        limit: 10,
        search,
        departmentId: deptFilter,
        employmentStatus: statusFilter,
      });
      if (res.data?.success) {
        setEmployees(res.data.data);
        setTotalPages(res.data.pagination.totalPages);
        setTotal(res.data.pagination.total);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    departmentsApi.list().then((res) => {
      if (res.data?.data) setDepartments(res.data.data);
    });
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [page, search, deptFilter, statusFilter]);

  const handleCreateOrUpdate = async (formData: any) => {
    setModalLoading(true);
    try {
      if (editingEmployee) {
        await employeesApi.update(editingEmployee.id, formData);
        showToast('Employee updated successfully', 'success');
      } else {
        await employeesApi.create(formData);
        showToast('Employee created successfully with leave allocations & salary structure', 'success');
      }
      setShowCreateModal(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEmployee) return;
    setModalLoading(true);
    try {
      await employeesApi.delete(deletingEmployee.id);
      showToast('Employee deactivated and archived successfully', 'success');
      setDeletingEmployee(null);
      fetchEmployees();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete employee', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (emp) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 font-bold text-xs flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
            {emp.profile_photo ? (
              <img src={emp.profile_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              `${emp.first_name[0]}${emp.last_name[0]}`
            )}
          </div>
          <div>
            <Link
              to={`/employees/${emp.id}`}
              className="font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition"
            >
              {emp.first_name} {emp.last_name}
            </Link>
            <div className="text-xs text-slate-400">{emp.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'employee_id',
      header: 'ID / Code',
      render: (emp) => <span className="font-mono text-xs font-semibold text-slate-500">{emp.employee_id}</span>,
    },
    {
      key: 'department',
      header: 'Department & Role',
      render: (emp) => (
        <div>
          <div className="font-medium text-slate-800 dark:text-slate-200">{emp.designation}</div>
          <div className="text-xs text-slate-400">{emp.department_name || 'Unassigned'}</div>
        </div>
      ),
    },
    {
      key: 'employment_status',
      header: 'Status',
      render: (emp) => <StatusBadge status={emp.employment_status} />,
    },
    {
      key: 'basic_salary',
      header: 'Base Salary',
      render: (emp) => <span className="font-semibold text-slate-700 dark:text-slate-300">${Number(emp.basic_salary).toLocaleString()}</span>,
    },
    {
      key: 'joining_date',
      header: 'Joining Date',
      render: (emp) => <span className="text-xs text-slate-500">{emp.joining_date ? emp.joining_date.split('T')[0] : 'N/A'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (emp) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => navigate(`/employees/${emp.id}`)}
            title="View Details"
            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <Eye className="w-4 h-4" />
          </button>
          {hasPermission('employees.edit') && (
            <button
              onClick={() => {
                setEditingEmployee(emp);
                setShowCreateModal(true);
              }}
              title="Edit Profile"
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {hasPermission('employees.delete') && (
            <button
              onClick={() => setDeletingEmployee(emp)}
              title="Deactivate"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employee Roster"
        description="Comprehensive employee directory with active statuses, departments, and records"
        actions={
          hasPermission('employees.create') && (
            <button
              onClick={() => {
                setEditingEmployee(null);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          )
        }
      />

      {/* Filters Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="probation">Probation</option>
          <option value="notice_period">Notice Period</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={employees}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search employees by name, email, ID..."
        emptyTitle="No employees in database"
        emptyDescription="Add your first employee to populate the organizational directory."
        pagination={{
          page,
          limit: 10,
          total,
          totalPages,
          onPageChange: setPage,
        }}
      />

      {/* Create / Edit Modal */}
      <EmployeeModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingEmployee(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialData={editingEmployee}
        loading={modalLoading}
      />

      {/* Confirm Deletion */}
      <ConfirmDialog
        isOpen={!!deletingEmployee}
        onClose={() => setDeletingEmployee(null)}
        onConfirm={handleDelete}
        title="Deactivate Employee"
        message={`Are you sure you want to deactivate ${deletingEmployee?.first_name} ${deletingEmployee?.last_name}? Their user account will be suspended and employment status marked as terminated.`}
        confirmText="Deactivate"
        isDestructive
        loading={modalLoading}
      />
    </div>
  );
};
