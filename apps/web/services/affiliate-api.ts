/**
 * Affiliate API - handles affiliate endpoints for logged-in affiliates
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getAccessToken(): string | null {
  try {
    return localStorage.getItem('igb_access');
  } catch {
    return null;
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(endpoint: string): Promise<{ success: boolean; data?: T; error?: { message: string; code: string } }> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    // JWT expired or missing — clear stored tokens and bounce to /login
    if (response.status === 401) {
      try {
        localStorage.removeItem('igb_access');
        localStorage.removeItem('igb_refresh');
      } catch { /* localStorage unavailable */ }
      window.location.href = '/login';
      return {
        success: false,
        error: { message: 'Sessão expirada. Faça login novamente.', code: 'UNAUTHORIZED' },
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: data?.error?.message || data?.error || data?.message || 'Request failed',
          code: data?.error?.code || 'REQUEST_FAILED',
        },
      };
    }

    if (data?.success === false) {
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

// ============================================================================
// Types
// ============================================================================

export interface MyCampaign {
  id: string;
  slug: string;
  label: string | null;
  redirect_house_slug: string | null;
  tagged_house_slugs: string[];
  created_at: string;
}

export interface MyFunnelTotals {
  clicks: number;
  registers: number;
  first_proof: number;
  approved: number;
}

export interface MyFunnelResponse {
  totals: MyFunnelTotals;
  range: { from: string; to: string };
}

// ============================================================================
// API Methods
// ============================================================================

export const affiliateApi = {
  async getMyCampaigns(): Promise<{ success: boolean; data?: { campaigns: MyCampaign[] }; error?: { message: string; code: string } }> {
    return fetchJson<{ campaigns: MyCampaign[] }>('/affiliate/me/campaigns');
  },

  async getMyFunnel(filters?: { from?: string; to?: string }): Promise<{ success: boolean; data?: MyFunnelResponse; error?: { message: string; code: string } }> {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    const query = params.toString();
    return fetchJson<MyFunnelResponse>(`/affiliate/me/funnel${query ? `?${query}` : ''}`);
  },
};