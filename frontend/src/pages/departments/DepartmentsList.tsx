import React, { useState, useEffect } from 'react';
import { departmentsApi } from '../../api/services';
import { Department } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DepartmentModal } from './DepartmentModal';
import { Plus, Users, Edit2, Trash2, Building2 } from 'lucide-react';

export const DepartmentsList: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const { showToast } = useNotifications();
  const { hasPermission } = useAuth();

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await departmentsApi.list();
      if (res.data?.success) {
        setDepartments(res.data.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load departments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreateOrUpdate = async (formData: any) => {
    setModalLoading(true);
    try {
      if (editingDept) {
        await departmentsApi.update(editingDept.id, formData);
        showToast('Department updated successfully', 'success');
      } else {
        await departmentsApi.create(formData);
        showToast('Department created successfully', 'success');
      }
      setShowModal(false);
      setEditingDept(null);
      fetchDepartments();
    } catch (err: any) {
      showToast(err.message || 'Failed to save department', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDept) return;
    setModalLoading(true);
    try {
      await departmentsApi.delete(deletingDept.id);
      showToast('Department deleted successfully', 'success');
      setDeletingDept(null);
      fetchDepartments();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete department', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage company divisions, assign department heads, and track headcounts"
        actions={
          hasPermission('departments.manage') && (
            <button
              onClick={() => {
                setEditingDept(null);
                setShowModal(true);
              }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Department
            </button>
          )
        }
      />

      {loading ? (
        <div className="py-24 flex justify-center">
          <LoadingState message="Loading departments..." />
        </div>
      ) : departments.length === 0 ? (
        <EmptyState
          title="No departments found"
          description="Create your first department (e.g. Engineering, Sales, QA) to organize your team."
          action={
            hasPermission('departments.manage') && (
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl"
              >
                Create Department
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">{dept.name}</h3>
                      <StatusBadge status={dept.status} className="mt-1" />
                    </div>
                  </div>

                  {hasPermission('departments.manage') && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingDept(dept);
                          setShowModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingDept(dept)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                  {dept.description || 'No departmental description provided.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{dept.employee_count || 0} Employees</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Head of Dept</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {dept.manager_name || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Department Modal */}
      <DepartmentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingDept(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialData={editingDept}
        loading={modalLoading}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingDept}
        onClose={() => setDeletingDept(null)}
        onConfirm={handleDelete}
        title="Delete Department"
        message={`Are you sure you want to delete the "${deletingDept?.name}" department? Active employees must be reassigned first.`}
        confirmText="Delete"
        isDestructive
        loading={modalLoading}
      />
    </div>
  );
};
