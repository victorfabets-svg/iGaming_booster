/**
 * Auth API - handles authentication endpoints
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return {
        success: false,
        error: {
          message: data.error?.message || data.message || 'Request failed',
          code: data.error?.code || 'REQUEST_FAILED',
        },
      };
    }

    return { success: true, data: data.data };
  } catch (err) {
    return {
      success: false,
      error: {
        message: err instanceof Error ? err.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

export const authApi = {
  /**
   * Login with email and password
   */
  async login(
    email: string,
    password: string
  ): Promise<ApiResponse<LoginResponse>> {
    return fetchJson<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    displayName?: string,
    cid?: string
  ): Promise<ApiResponse<{ user_id: string; email: string }>> {
    const body: Record<string, unknown> = { email, password, display_name: displayName };
    if (cid) body.cid = cid;
    return fetchJson<{ user_id: string; email: string }>('/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /**
   * Verify email with token
   */
  async verifyEmail(
    token: string
  ): Promise<ApiResponse<LoginResponse>> {
    return fetchJson<LoginResponse>('/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  /**
   * Resend verification email
   */
  async resendVerification(
    email: string
  ): Promise<ApiResponse<{ message: string }>> {
    return fetchJson<{ message: string }>('/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /**
   * Refresh access token
   */
  async refresh(
    refreshToken: string
  ): Promise<ApiResponse<RefreshResponse>> {
    return fetchJson<RefreshResponse>('/token/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  /**
   * Logout (revokes refresh token)
   */
  async logout(refreshToken: string): Promise<ApiResponse<{ ok: boolean }>> {
    const accessToken = localStorage.getItem('igb_access') || import.meta.env.VITE_DEV_JWT;
    
    return fetchJson<{ ok: boolean }>('/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },
};