/**
 * ME API - handles user endpoints
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

interface UserInfo {
  id: string;
  email: string;
  role: string;
  email_verified: boolean;
  display_name: string | null;
  created_at: string;
}

interface Ticket {
  id: string;
  raffle_id: string;
  raffle_name: string;
  ticket_number: number;
  status: string;
  created_at: string;
}

interface Raffle {
  id: string;
  name: string;
  prize: string;
  draw_date: string;
  status: string;
  my_ticket_count: number;
  my_ticket_numbers?: number[];
}

interface Subscription {
  id: string;
  plan_slug: string;
  plan_name: string;
  status: string;
  current_period_end: string;
  created_at: string;
}

interface Tip {
  id: string;
  house: string;
  market: string;
  odds: number;
  status: string;
  created_at: string;
}

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const accessToken = localStorage.getItem('igb_access');
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      try {
        localStorage.removeItem('igb_access');
        localStorage.removeItem('igb_refresh');
      } catch { /* localStorage may be unavailable */ }
      const here = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(here)}`;
      return {
        success: false,
        error: { message: 'Sessão expirada. Faça login novamente.', code: 'UNAUTHORIZED' },
      };
    }

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

export const meApi = {
  /**
   * Get current user info
   */
  async getMe(): Promise<ApiResponse<UserInfo>> {
    return fetchJson<UserInfo>('/me');
  },

  /**
   * Update user info
   */
  async updateMe(
    displayName?: string
  ): Promise<ApiResponse<UserInfo>> {
    return fetchJson<UserInfo>('/me', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: displayName }),
    });
  },

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<{ message: string }>> {
    return fetchJson<{ message: string }>('/me/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },

  /**
   * Get user's tickets
   */
  async getTickets(): Promise<ApiResponse<{ tickets: Ticket[] }>> {
    return fetchJson<{ tickets: Ticket[] }>('/me/tickets');
  },

  /**
   * Get user's raffles
   */
  async getRaffles(): Promise<ApiResponse<{ raffles: Raffle[] }>> {
    return fetchJson<{ raffles: Raffle[] }>('/me/raffles');
  },

  /**
   * Get single raffle with user's tickets
   */
  async getRaffle(
    id: string
  ): Promise<ApiResponse<{
      raffle: {
        id: string;
        name: string;
        prize: string;
        draw_date: string;
        status: string;
        total_numbers: number;
        winning_number: number | null;
      };
      tickets: Ticket[];
    }>> {
    return fetchJson<any>(`/me/raffles/${id}`);
  },

  /**
   * Get user's subscription
   */
  async getSubscription(): Promise<ApiResponse<{ subscription: Subscription | null }>> {
    return fetchJson<{ subscription: Subscription | null }>('/me/subscription');
  },

  /**
   * Get tips
   */
  async getTips(): Promise<ApiResponse<{
    tips: Tip[];
    locked: boolean;
    reason?: string;
  }>> {
    return fetchJson<{
      tips: Tip[];
      locked: boolean;
      reason?: string;
    }>('/me/tips');
  },

  /**
   * Get active promotions in window
   */
  async getPromotions(): Promise<ApiResponse<{ promotions: MePromotion[] }>> {
    return fetchJson<{ promotions: MePromotion[] }>('/me/promotions');
  },

  /**
   * Get single promotion + invitation pending flag
   */
  async getPromotion(slug: string): Promise<ApiResponse<{
    promotion: MePromotion & { user_has_invitation_pending: boolean };
  }>> {
    return fetchJson(`/me/promotions/${slug}`);
  },

  /**
   * List repescagem invitations for current user (pending only)
   */
  async getInvitations(): Promise<ApiResponse<{ invitations: RepescagemInvitation[] }>> {
    return fetchJson<{ invitations: RepescagemInvitation[] }>('/me/repescagem/invitations');
  },

  /**
   * Accept a repescagem invitation — emits new ticket in the promotion's raffle
   */
  async acceptInvitation(id: string): Promise<ApiResponse<{
    invitation: { id: string; status: string; decided_at: string };
    ticket: { id: string; number: number; raffle_id: string };
  }>> {
    return fetchJson(`/me/repescagem/invitations/${id}/accept`, { method: 'POST' });
  },

  /**
   * Decline a repescagem invitation
   */
  async declineInvitation(id: string): Promise<ApiResponse<{
    invitation: { id: string; status: string; decided_at: string };
  }>> {
    return fetchJson(`/me/repescagem/invitations/${id}/decline`, { method: 'POST' });
  },
};

export interface MePromotionTier {
  min_deposit_cents: number;
  tickets: number;
}

export interface MePromotion {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creative_url: string | null;
  house_slug: string;
  house_name: string;
  deposit_url: string;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  tiers: MePromotionTier[];
}

export interface RepescagemInvitation {
  id: string;
  promotion_id: string;
  promotion_slug: string;
  promotion_name: string;
  promotion_creative_url: string | null;
  source_promotion_slug: string;
  source_promotion_name: string;
  created_at: string;
}