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
};