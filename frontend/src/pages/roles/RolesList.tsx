import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, Check, Save, Lock, 
  Users, KeyRound, AlertCircle 
} from 'lucide-react';
import { rolesApi } from '../../api/services';
import { Role, Permission } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const RolesList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New Role Modal
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const fetchRolesData = async () => {
    try {
      setLoading(true);
      const [rolesRes, permRes] = await Promise.all([
        rolesApi.getAll(),
        rolesApi.getPermissions(),
      ]);

      const allRoles: Role[] = rolesRes.data.data;
      setRoles(allRoles);
      setPermissions(permRes.data.data);

      if (allRoles.length > 0 && !selectedRole) {
        setSelectedRole(allRoles[0]);
        loadRolePermissions(allRoles[0]);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load roles and permissions matrix');
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async (role: Role) => {
    try {
      const res = await rolesApi.getById(role.id);
      const permIds = (res.data.data.permissions || []).map((p: any) => p.id || p);
      setRolePermissions(permIds);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRolesData();
  }, []);

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    loadRolePermissions(role);
  };

  const handleTogglePermission = (permId: number) => {
    setRolePermissions((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await rolesApi.assignPermissions(selectedRole.id, {
        permission_ids: rolePermissions,
      });
      showNotification('success', `Permissions updated for role: ${selectedRole.name}`);
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    try {
      const res = await rolesApi.create({
        name: newRoleName.trim(),
        description: newRoleDesc.trim(),
      });
      showNotification('success', 'Role created successfully');
      setCreateRoleOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      fetchRolesData();
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to create role');
    }
  };

  if (loading) return <LoadingState text="Loading permission matrix..." />;

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc: any, perm) => {
    const mod = perm.module || 'general';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Access Control (RBAC)"
        subtitle="Configure granular security permissions, role tiers, and access boundaries"
        action={
          hasPermission('roles.create') && (
            <button
              onClick={() => setCreateRoleOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Custom Role
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Role Selector */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            System & Custom Roles
          </h3>

          <div className="space-y-1">
            {roles.map((r) => {
              const isSelected = selectedRole?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => handleSelectRole(r)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="capitalize">{r.name.replace(/_/g, ' ')}</span>
                  </div>
                  {r.is_system && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        isSelected
                          ? 'bg-indigo-700 text-indigo-100'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                      }`}
                    >
                      System
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 3 Cols: Permissions Matrix for Selected Role */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                Permissions for: {selectedRole?.name.replace(/_/g, ' ')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedRole?.description || 'Manage what this role can view, create, edit, or delete.'}
              </p>
            </div>

            {hasPermission('roles.edit') && (
              <button
                onClick={handleSavePermissions}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            )}
          </div>

          {/* Module-wise Permission Checkboxes */}
          <div className="space-y-6">
            {Object.keys(groupedPermissions).map((mod) => (
              <div key={mod} className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-slate-50 dark:bg-slate-700/30 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                  {mod.replace(/_/g, ' ')} Module
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {groupedPermissions[mod].map((perm: Permission) => {
                    const isChecked = rolePermissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-900 text-indigo-900 dark:text-indigo-200'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePermission(perm.id)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="font-semibold block">{perm.name}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {perm.code}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Role Modal */}
      <Modal
        isOpen={createRoleOpen}
        onClose={() => setCreateRoleOpen(false)}
        title="Create New Custom Role"
        size="sm"
      >
        <form onSubmit={handleCreateRole} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. billing_specialist"
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              placeholder="Role responsibilities..."
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setCreateRoleOpen(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium"
            >
              Create Role
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
