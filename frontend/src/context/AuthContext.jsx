import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import i18n from '../i18n';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('nexcampus_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('nexcampus_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUserSession = async () => {
      const storedToken = localStorage.getItem('nexcampus_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.data.success) {
            setUser(res.data.user);
            localStorage.setItem('nexcampus_user', JSON.stringify(res.data.user));
            if (res.data.user.preferredLanguage) {
              i18n.changeLanguage(res.data.user.preferredLanguage);
              localStorage.setItem('nexcampus_language', res.data.user.preferredLanguage);
              document.documentElement.lang = res.data.user.preferredLanguage;
            }
          }
        } catch (err) {
          console.warn('[Session Verification] Token invalid or expired');
          localStorage.removeItem('nexcampus_token');
          localStorage.removeItem('nexcampus_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    verifyUserSession();
  }, []);

  const login = async (identifierOrEmail, password) => {
    const res = await api.post('/auth/login', {
      identifier: identifierOrEmail,
      email: identifierOrEmail,
      password
    });
    if (res.data.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('nexcampus_token', res.data.token);
      localStorage.setItem('nexcampus_user', JSON.stringify(res.data.user));
      if (res.data.user.preferredLanguage) {
        i18n.changeLanguage(res.data.user.preferredLanguage);
        localStorage.setItem('nexcampus_language', res.data.user.preferredLanguage);
        document.documentElement.lang = res.data.user.preferredLanguage;
      }
      return { success: true, user: res.data.user };
    }
    return { success: false, message: res.data.message };
  };

  const registerStudent = async (studentData) => {
    const res = await api.post('/auth/register-student', studentData);
    if (res.data.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('nexcampus_token', res.data.token);
      localStorage.setItem('nexcampus_user', JSON.stringify(res.data.user));
      return { success: true, user: res.data.user };
    }
    return { success: false, message: res.data.message };
  };

  const logout = () => {
    localStorage.removeItem('nexcampus_token');
    localStorage.removeItem('nexcampus_user');
    setToken(null);
    setUser(null);
  };

  const hasRole = (role) => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    if (Array.isArray(user.roles)) {
      if (user.roles.includes(role)) return true;
      if (user.roles.some((r) => (typeof r === 'object' ? r?.name === role : r === role))) return true;
    }
    if (typeof user.role === 'string') {
      return user.role === role;
    }
    return false;
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return user.permissions && user.permissions.includes(permission);
  };

  const isCMO = () => {
    if (!user) return false;
    return user.isSuperAdmin || user.isCMO || (user.roles && user.roles.includes('cmo'));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        registerStudent,
        logout,
        hasRole,
        hasPermission,
        isCMO,
        isAuthenticated: !!token && !!user
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

export default AuthContext;
