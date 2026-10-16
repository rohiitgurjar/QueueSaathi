import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, resetCsrfToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest('/auth/me')
      .then(({ user: currentUser }) => { if (active) setUser(currentUser); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  async function signIn(credentials) {
    const { user: currentUser } = await apiRequest('/auth/login', { method: 'POST', body: credentials });
    setUser(currentUser);
    return currentUser;
  }

  async function signUp(details) {
    const { user: currentUser } = await apiRequest('/auth/register', { method: 'POST', body: details });
    setUser(currentUser);
    return currentUser;
  }

  async function signOut() {
    try {
      await apiRequest('/auth/logout', { method: 'POST', body: {} });
    } finally {
      resetCsrfToken();
      setUser(null);
    }
  }

  const value = useMemo(() => ({ user, authLoading, signIn, signUp, signOut }), [user, authLoading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

export { AuthContext };
