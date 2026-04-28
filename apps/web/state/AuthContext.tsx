/**
 * Auth Context - manages authentication state and tokens
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/auth-api';
import { meApi } from '../services/me-api';

interface User {
  id: string;
  email: string;
  role: string;
  email_verified?: boolean;
  display_name?: string | null;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEmailVerified: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setSession: (tokens: { access_token: string; refresh_token: string | null }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACCESS_KEY = 'igb_access';
const REFRESH_KEY = 'igb_refresh';

/**
 * Decode JWT to get user info (no signature verification for display only)
 */
function decodeJwt(token: string): { sub?: string; user_id?: string; email?: string; role?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Add padding if needed
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load tokens from localStorage on mount
  useEffect(() => {
    const storedAccess = localStorage.getItem(ACCESS_KEY);
    const storedRefresh = localStorage.getItem(REFRESH_KEY);
    
    // Fallback to dev JWT if no stored tokens (for local dev)
    const devJwt = import.meta.env.VITE_DEV_JWT;
    const effectiveAccess = storedAccess || devJwt || null;
    const effectiveRefresh = storedRefresh || null;

    if (effectiveAccess) {
      const decoded = decodeJwt(effectiveAccess);
      if (decoded) {
        setUser({
          id: decoded.sub || decoded.user_id || '',
          email: decoded.email || '',
          role: decoded.role || 'user',
        });
        setAccessToken(effectiveAccess);
        setRefreshToken(effectiveRefresh);
      }
    }
    setIsLoading(false);
  }, []);

  // Fetch user details from /me when authenticated
  useEffect(() => {
    if (!accessToken) return;

    meApi.getMe().then(response => {
      if (response.success && response.data) {
        setUser(prev => prev ? { 
          ...prev, 
          email_verified: response.data!.email_verified,
          display_name: response.data!.display_name,
        } : null);
      }
    });
  }, [accessToken]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    if (!response.success || !response.data) {
      // Check for EMAIL_NOT_VERIFIED error code
      if (response.error?.code === 'EMAIL_NOT_VERIFIED') {
        throw new Error('EMAIL_NOT_VERIFIED');
      }
      throw new Error(response.error?.message || 'Login failed');
    }

    const { access_token, refresh_token } = response.data;
    const decoded = decodeJwt(access_token);
    
    const newUser: User = {
      id: decoded?.sub || decoded?.user_id || '',
      email: decoded?.email || email,
      role: decoded?.role || 'user',
    };

    localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) {
      localStorage.setItem(REFRESH_KEY, refresh_token);
    }

    setUser(newUser);
    setAccessToken(access_token);
    setRefreshToken(refresh_token);
  }, []);

  const logout = useCallback(async () => {
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Ignore logout errors
      }
    }
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, [refreshToken]);

  const refresh = useCallback(async () => {
    const storedRefresh = localStorage.getItem(REFRESH_KEY);
    if (!storedRefresh) {
      // No refresh token, clear auth
      localStorage.removeItem(ACCESS_KEY);
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      return;
    }

    try {
      const response = await authApi.refresh(storedRefresh);
      if (!response.success || !response.data) {
        // Refresh failed, clear tokens
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        return;
      }

      const { access_token, refresh_token } = response.data;
      const decoded = decodeJwt(access_token);

      localStorage.setItem(ACCESS_KEY, access_token);
      if (refresh_token) {
        localStorage.setItem(REFRESH_KEY, refresh_token);
      }

      setUser({
        id: decoded?.sub || decoded?.user_id || '',
        email: decoded?.email || '',
        role: decoded?.role || 'user',
      });
      setAccessToken(access_token);
      setRefreshToken(refresh_token);
    } catch {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    }
  }, []);

  const setSession = useCallback((tokens: { access_token: string; refresh_token: string | null }) => {
    const { access_token, refresh_token } = tokens;
    const decoded = decodeJwt(access_token);

    localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) {
      localStorage.setItem(REFRESH_KEY, refresh_token);
    }

    setUser({
      id: decoded?.sub || decoded?.user_id || '',
      email: decoded?.email || '',
      role: decoded?.role || 'user',
    });
    setAccessToken(access_token);
    setRefreshToken(refresh_token);
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    refreshToken,
    isAuthenticated: !!user && !!accessToken,
    isAdmin: user?.role === 'admin',
    isEmailVerified: user?.email_verified ?? true,
    isLoading,
    login,
    logout,
    refresh,
    setSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}