import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../api/services';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: any) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('authUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const res = await authApi.getMe();
          if (res.data?.success && res.data.data) {
            setUser(res.data.data);
            localStorage.setItem('authUser', JSON.stringify(res.data.data));
          }
        } catch (err) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('authUser');
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await authApi.login({ email, password });
    const { accessToken, refreshToken, user: authUser } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('authUser', JSON.stringify(authUser));
    setUser(authUser);
    return authUser;
  };

  const register = async (data: any): Promise<User> => {
    const res = await authApi.register(data);
    const { accessToken, refreshToken, user: authUser } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('authUser', JSON.stringify(authUser));
    setUser(authUser);
    return authUser;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    setUser(null);
    window.location.href = '/login';
  };

  const updateProfile = async (data: any) => {
    await authApi.updateProfile(data);
    const res = await authApi.getMe();
    if (res.data?.data) {
      setUser(res.data.data);
      localStorage.setItem('authUser', JSON.stringify(res.data.data));
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    const role = user.roleName || user.role_name || user.role;
    if (role === 'super_admin' || role === 'admin') return true;
    return user.permissions?.includes(permission) || false;
  };

  const hasRole = (...roles: string[]): boolean => {
    if (!user) return false;
    const role = user.roleName || user.role_name || user.role || '';
    if (role === 'super_admin') return true;
    return roles.includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
