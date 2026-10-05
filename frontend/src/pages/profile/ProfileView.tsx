import React, { useState } from 'react';
import { 
  User, Lock, Shield, Mail, KeyRound, 
  CheckCircle2, AlertCircle, Save 
} from 'lucide-react';
import { authApi } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { PageHeader } from '../../components/ui/PageHeader';

export const ProfileView: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile update state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await authApi.updateProfile(profileData);
      showNotification('success', 'Profile information updated successfully');
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      showNotification('error', 'New passwords do not match');
      return;
    }
    if (passwordData.new_password.length < 6) {
      showNotification('error', 'Password must be at least 6 characters');
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      showNotification('success', 'Security password changed successfully');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      showNotification('error', err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="My Account & Security"
        subtitle="Manage personal contact details, security credentials, and authentication keys"
      />

      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Profile Information
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'password'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Change Password
        </button>
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={handleUpdateProfile} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
            <div className="w-14 h-14 rounded-full bg-indigo-600 text-white font-black text-xl flex items-center justify-center">
              {user?.name ? user.name[0] : 'U'}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{user?.name}</h3>
              <p className="text-xs text-slate-500 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? 'Saving...' : 'Update Profile'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Current Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={passwordData.current_password}
              onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={passwordData.new_password}
              onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              {savingPassword ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
