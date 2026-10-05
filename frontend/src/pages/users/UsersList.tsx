import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Filter, ShieldCheck, 
  KeyRound, CheckCircle, XCircle, Edit, Trash2 
} from 'lucide-react';
import { usersApi, rolesApi } from '../../api/services';
import { User, Role } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const UsersList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role_id: '',
    status: 'active',
  });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [uRes, rRes] = await Promise.all([
        usersApi.getAll({
          search: search || undefined,
          role_id: roleFilter || undefined,
          page,
          limit: 15,
        }),
        rolesApi.getAll(),
      ]);

      setUsers(uRes.data.data.users || uRes.data.data);
      if (uRes.data.data.pagination) {
        setTotalPages(uRes.data.data.pagination.totalPages || 1);
        setTotalRecords(uRes.data.data.pagination.total || 0);
      }
      setRoles(rRes.data.data);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, page]);

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role_id: roles.length > 0 ? String(roles[0].id) : '',
      status: 'active',
    });
    setUserModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role_id: user.role_id ? String(user.role_id) : '',
      status: user.status || 'active',
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      showNotification('error', 'Name and email are required');
      return;
    }

    try {
      if (selectedUser) {
        await usersApi.update(selectedUser.id, {
          name: formData.name,
          email: formData.email,
          role_id: Number(formData.role_id),
          status: formData.status,
          ...(formData.password ? { password: formData.password } : {}),
        });
        showNotification('success', 'User updated successfully');
      } else {
        if (!formData.password) {
          showNotification('error', 'Password is required for new user');
          return;
        }
        await usersApi.create({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role_id: Number(formData.role_id),
          status: formData.status,
        });
        showNotification('success', 'User account created successfully');
      }
      setUserModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to save user account');
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await usersApi.delete(userToDelete.id);
      showNotification('success', 'User account deactivated');
      fetchUsers();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to delete user');
    }
  };

  const columns: Column<User>[] = [
    {
      header: 'User & Email',
      accessor: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
            {u.name ? u.name[0] : 'U'}
          </div>
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">{u.name}</span>
            <div className="text-xs text-slate-500">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Assigned Role',
      accessor: (u) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 capitalize">
          {u.role_name || u.role || 'Staff'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (u) => <StatusBadge status={u.status} />,
    },
    {
      header: 'Last Login',
      accessor: (u) => (
        <span className="text-xs text-slate-500">
          {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (u) => (
        <div className="flex items-center justify-end gap-1.5">
          {hasPermission('users.edit') && (
            <button
              onClick={() => handleOpenEdit(u)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded transition-colors"
              title="Edit User"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {hasPermission('users.delete') && u.role !== 'super_admin' && (
            <button
              onClick={() => {
                setUserToDelete(u);
                setDeleteDialogOpen(true);
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
              title="Delete User"
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
      <PageHeader
        title="User Accounts & Authentication"
        subtitle="Manage login credentials, security access levels, and active employee credentials"
        action={
          hasPermission('users.create') && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create User Account
            </button>
          )
        }
      />

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search user name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
        >
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={users}
        keyField="id"
        loading={loading}
        emptyMessage="No user accounts found."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {/* User Modal */}
      {userModalOpen && (
        <Modal
          isOpen={userModalOpen}
          onClose={() => setUserModalOpen(false)}
          title={selectedUser ? 'Edit User Account' : 'Create New User Account'}
          size="md"
        >
          <form onSubmit={handleSaveUser} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {selectedUser ? 'New Password (Leave blank to keep current)' : 'Password *'}
              </label>
              <input
                type="password"
                required={!selectedUser}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={selectedUser ? '••••••••' : 'Enter strong password'}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assign Role <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.role_id}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive / Suspended</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium"
              >
                {selectedUser ? 'Update Account' : 'Create Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Deactivate User"
        message={`Are you sure you want to deactivate user account "${userToDelete?.name}"?`}
        confirmText="Deactivate"
        type="danger"
      />
    </div>
  );
};
