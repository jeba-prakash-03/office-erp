import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { searchApi } from '../../api/services';
import {
  Search,
  Bell,
  Sun,
  Moon,
  User as UserIcon,
  LogOut,
  Settings,
  Menu,
  Check,
  Building,
  Users,
  Briefcase,
  CheckSquare,
  FileText,
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Dropdown states
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Global search effect
  useEffect(() => {
    const handleSearch = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults(null);
        return;
      }
      setIsSearching(true);
      try {
        const res = await searchApi.global(searchQuery);
        if (res.data?.success) {
          setSearchResults(res.data.data);
        }
      } catch (err) {
        // Silently handle search err
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchModal(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchResultClick = (path: string) => {
    setShowSearchModal(false);
    setSearchQuery('');
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left Side: Mobile toggle & Search */}
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Global Search Box */}
          <div ref={searchRef} className="relative w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSearchModal(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Global search (employees, clients, projects, tasks, invoices)..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800/80 border-transparent focus:border-brand-500 border rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            {/* Instant Search Results Dropdown */}
            {showSearchModal && searchQuery.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-fadeIn">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-slate-500">Searching system database...</div>
                ) : !searchResults || (
                    searchResults.employees.length === 0 &&
                    searchResults.clients.length === 0 &&
                    searchResults.projects.length === 0 &&
                    searchResults.tasks.length === 0 &&
                    searchResults.invoices.length === 0
                  ) ? (
                  <div className="p-4 text-center text-xs text-slate-500">No matching records found.</div>
                ) : (
                  <>
                    {searchResults.employees.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Employees</div>
                        {searchResults.employees.map((emp: any) => (
                          <button
                            key={emp.id}
                            onClick={() => handleSearchResultClick(`/employees/${emp.id}`)}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm"
                          >
                            <Users className="w-4 h-4 text-brand-500" />
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-200">{emp.title}</div>
                              <div className="text-xs text-slate-400">{emp.subtitle} • {emp.employee_id}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.clients.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Clients</div>
                        {searchResults.clients.map((cli: any) => (
                          <button
                            key={cli.id}
                            onClick={() => handleSearchResultClick(`/clients/${cli.id}`)}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm"
                          >
                            <Building className="w-4 h-4 text-emerald-500" />
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-200">{cli.title}</div>
                              <div className="text-xs text-slate-400">Contact: {cli.subtitle} • {cli.client_code}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.projects.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Projects</div>
                        {searchResults.projects.map((prj: any) => (
                          <button
                            key={prj.id}
                            onClick={() => handleSearchResultClick(`/projects/${prj.id}`)}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm"
                          >
                            <Briefcase className="w-4 h-4 text-purple-500" />
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-200">{prj.title}</div>
                              <div className="text-xs text-slate-400">{prj.project_code} • {prj.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.tasks.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tasks</div>
                        {searchResults.tasks.map((tsk: any) => (
                          <button
                            key={tsk.id}
                            onClick={() => handleSearchResultClick(`/tasks/${tsk.id}`)}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm"
                          >
                            <CheckSquare className="w-4 h-4 text-amber-500" />
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-200">{tsk.title}</div>
                              <div className="text-xs text-slate-400">{tsk.task_code} • {tsk.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.invoices.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Invoices</div>
                        {searchResults.invoices.map((inv: any) => (
                          <button
                            key={inv.id}
                            onClick={() => handleSearchResultClick(`/invoices/${inv.id}`)}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm"
                          >
                            <FileText className="w-4 h-4 text-blue-500" />
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-200">{inv.title}</div>
                              <div className="text-xs text-slate-400">Amount: ${Number(inv.grand_total).toLocaleString()} • {inv.subtitle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2">
          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Notifications Center */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fadeIn">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</h4>
                    <p className="text-xs text-slate-500">{unreadCount} unread message{unreadCount !== 1 ? 's' : ''}</p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Check className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">No notifications yet.</div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (!notif.is_read) markAsRead(notif.id);
                          if (notif.link) {
                            setShowNotifMenu(false);
                            navigate(notif.link);
                          }
                        }}
                        className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition flex items-start gap-3 ${
                          !notif.is_read ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-brand-500 opacity-80"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{notif.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2.5 p-1 pl-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-600 text-white font-semibold text-xs flex items-center justify-center shadow-sm">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  `${user?.firstName?.[0] || 'U'}${user?.lastName?.[0] || ''}`
                )}
              </div>
              <div className="hidden sm:block text-left pr-1">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {user?.roleDisplayName || user?.roleName?.replace(/_/g, ' ')}
                </div>
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 p-1.5 animate-fadeIn text-sm">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-xs font-medium mt-1"
                >
                  <UserIcon className="w-4 h-4 text-slate-400" /> My Profile
                </Link>

                <Link
                  to="/settings"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-xs font-medium"
                >
                  <Settings className="w-4 h-4 text-slate-400" /> Company Settings
                </Link>

                <button
                  onClick={logout}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition text-xs font-medium mt-1 border-t border-slate-100 dark:border-slate-800"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
