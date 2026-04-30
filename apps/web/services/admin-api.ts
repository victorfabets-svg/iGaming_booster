/**
 * Admin API - handles admin endpoints
 */

import { getAccessToken } from './api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: { message: string; code: string } }> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    // JWT expired or missing — clear stored tokens and bounce the user to
    // /login so they don't sit on an "Erro ao carregar" screen forever.
    if (response.status === 401) {
      try {
        localStorage.removeItem('igb_access');
        localStorage.removeItem('igb_refresh');
      } catch { /* localStorage may be unavailable in some browsers */ }
      const here = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(here)}`;
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

    // Some admin routes (subscription, whatsapp) skip the {success,data}
    // envelope and return the payload at the top level. Accept both shapes:
    //   envelope:  { success: true, data: { plans: [...] } }   → unwrap data.data
    //   raw:       { plans: [...] }                            → use the body
    // Explicit { success: false } is still an error.
    if (data?.success === false) {
      return {
        success: false,
        error: {
          message: data.error?.message || data.message || 'Request failed',
          code: data.error?.code || 'REQUEST_FAILED',
        },
      };
    }
    const payload = data?.success === true ? data.data : data;
    return { success: true, data: payload };
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

export interface PartnerHouse {
  id: string;
  slug: string;
  name: string;
  country: string;
  currency: string;
  ocr_aliases?: string[];
  deposit_keywords?: string[];
  min_amount?: number;
  max_amount?: number;
  regex_patterns?: string[];
  active: boolean;
  tickets_per_deposit: number;
  min_amount_per_ticket_cents: number | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerHouseInput {
  slug: string;
  name: string;
  country: string;
  currency: string;
  ocr_aliases?: string[];
  deposit_keywords?: string[];
  min_amount?: number;
  max_amount?: number;
  regex_patterns?: string[];
  active?: boolean;
  tickets_per_deposit?: number;
  min_amount_per_ticket_cents?: number | null;
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  billing_cycle: 'monthly' | 'annual';
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PlanInput {
  slug: string;
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  billing_cycle: 'monthly' | 'annual';
  metadata?: Record<string, unknown>;
}

export interface PlanUpdate {
  name?: string;
  description?: string;
  price_cents?: number;
  metadata?: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  external_id: string;
  user_id: string | null;
  plan_slug: string;
  status: 'pending' | 'active' | 'canceled' | 'expired';
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  expired_at: string | null;
  amount_cents: number | null;
  currency: string | null;
  provider: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionFilters {
  status?: 'pending' | 'active' | 'canceled' | 'expired';
  plan_slug?: string;
  since?: string;
  until?: string;
}

export interface Tip {
  id: string;
  external_id: string;
  house_slug: string;
  status: 'pending' | 'won' | 'lost' | 'void';
  amount_cents?: number;
  odds?: number;
  result?: string;
  created_at: string;
  settled_at?: string;
}

export interface WhatsAppSubscriber {
  id: string;
  phone_number: string;
  status: 'active' | 'opted_out';
  tier?: string;
  language?: string;
  user_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppSubscriberInput {
  phone_number: string;
  tier?: string;
  language?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
}

export interface WhatsAppDelivery {
  id: string;
  subscriber_id: string;
  phone_number: string;
  status: string;
  message?: string;
  sent_at: string;
  delivered_at?: string;
}

export interface IntegrationConfig {
  key: string;
  label: string;
  category: 'ocr' | 'whatsapp' | 'tipster' | 'subscription' | 'storage' | 'security';
  configured: boolean;
  masked_value: string | null;
  description: string;
  edit_url: string;
}

export interface AdminMetrics {
  houses_count: number;
  plans_count: number;
  active_subscriptions_count: number;
  active_subscribers_count: number;
}

export interface EmailTemplate {
  key: string;
  subject: string;
  html_body: string;
  description: string | null;
  supported_variables: string[];
  updated_at: string;
}

export interface AffiliateHouse {
  id: string;
  slug: string;
  name: string;
  domain: string;
  base_url: string;
  cpa_brl: number;
  revshare_pct: number;
  active: boolean;
  created_at: string;
}

export interface AffiliateHouseCreateInput {
  slug: string;
  name: string;
  domain: string;
  base_url: string;
  cpa_brl?: number;
  revshare_pct?: number;
  active?: boolean;
}

export interface AffiliateHouseUpdateInput {
  name?: string;
  domain?: string;
  base_url?: string;
  cpa_brl?: number;
  revshare_pct?: number;
  active?: boolean;
}

export interface AffiliateCampaign {
  id: string;
  slug: string;
  label: string | null;
  created_at: string;
  owner_user_id: string | null;
  owner_email: string | null;
  redirect_house_id: string | null;
  redirect_house_slug: string | null;
  tagged_house_slugs: string[];
}

export interface AffiliateCampaignCreateInput {
  slug: string;
  label?: string;
  owner_user_id?: string;
  redirect_house_slug?: string;
  tagged_house_slugs?: string[];
}

export interface AffiliateFunnelRow {
  slug: string;
  name: string;
  clicks: number;
  registers: number;
  first_proof: number;
  approved: number;
  rewards: number;
}

export interface AffiliateFunnelFilters {
  house?: string;
  from?: string;
  to?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'affiliate';
  email_verified: boolean;
  display_name: string | null;
  created_at: string;
}

export interface AdminUserFilters {
  role?: 'user' | 'admin' | 'affiliate';
  q?: string;
  limit?: number;
}

// ============================================================================
// API Methods
// ============================================================================

export const adminApi = {
  // -------------------------------------------------------------------------
  // Partner Houses
  // -------------------------------------------------------------------------
  async listPartnerHouses() {
    return fetchJson<{ houses: PartnerHouse[] }>('/admin/partner-houses');
  },

  async createPartnerHouse(input: PartnerHouseInput) {
    return fetchJson<{ house: PartnerHouse }>('/admin/partner-houses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // -------------------------------------------------------------------------
  // Plans
  // -------------------------------------------------------------------------
  async listPlans() {
    return fetchJson<{ plans: Plan[] }>('/admin/subscriptions/plans');
  },

  async createPlan(input: PlanInput) {
    return fetchJson<{ plan: Plan }>('/admin/subscriptions/plans', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updatePlan(slug: string, update: PlanUpdate) {
    return fetchJson<{ plan: Plan }>(`/admin/subscriptions/plans/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
  },

  async deactivatePlan(slug: string) {
    return fetchJson<{ plan: Plan }>(`/admin/subscriptions/plans/${slug}/deactivate`, {
      method: 'POST',
    });
  },

  async reactivatePlan(slug: string) {
    return fetchJson<{ plan: Plan }>(`/admin/subscriptions/plans/${slug}/reactivate`, {
      method: 'POST',
    });
  },

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------
  async listSubscriptions(filters?: SubscriptionFilters) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.plan_slug) params.set('plan_slug', filters.plan_slug);
    if (filters?.since) params.set('since', filters.since);
    if (filters?.until) params.set('until', filters.until);
    const query = params.toString();
    return fetchJson<{ subscriptions: Subscription[] }>(
      `/admin/subscriptions${query ? `?${query}` : ''}`
    );
  },

  async cancelSubscription(id: string) {
    return fetchJson<{ subscription: Subscription }>(`/admin/subscriptions/${id}/cancel`, {
      method: 'POST',
    });
  },

  // -------------------------------------------------------------------------
  // Tips (read-only)
  // -------------------------------------------------------------------------
  async listTips(filters?: { status?: string; house_slug?: string; since?: string; until?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.house_slug) params.set('house_slug', filters.house_slug);
    if (filters?.since) params.set('since', filters.since);
    if (filters?.until) params.set('until', filters.until);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return fetchJson<{ tips: Tip[] }>(`/admin/tips${query ? `?${query}` : ''}`);
  },

  async getTip(externalId: string) {
    return fetchJson<{ tip: Tip }>(`/admin/tips/${externalId}`);
  },

  // -------------------------------------------------------------------------
  // WhatsApp
  // -------------------------------------------------------------------------
  async listWhatsAppSubscribers(filters?: { status?: string; since?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.since) params.set('since', filters.since);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return fetchJson<{ subscribers: WhatsAppSubscriber[] }>(
      `/admin/whatsapp/subscribers${query ? `?${query}` : ''}`
    );
  },

  async createWhatsAppSubscriber(input: WhatsAppSubscriberInput) {
    return fetchJson<{ subscriber: WhatsAppSubscriber }>('/admin/whatsapp/subscribers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async optOutWhatsAppSubscriber(id: string, reason: string) {
    return fetchJson<{ subscriber: WhatsAppSubscriber }>(
      `/admin/whatsapp/subscribers/${id}/opt-out`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  },

  async listWhatsAppDeliveries(filters?: { subscriber_id?: string; since?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.subscriber_id) params.set('subscriber_id', filters.subscriber_id);
    if (filters?.since) params.set('since', filters.since);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return fetchJson<{ deliveries: WhatsAppDelivery[] }>(
      `/admin/whatsapp/deliveries${query ? `?${query}` : ''}`
    );
  },

  // -------------------------------------------------------------------------
  // Integrations (read-only)
  // -------------------------------------------------------------------------
  async listIntegrations() {
    return fetchJson<{ integrations: IntegrationConfig[] }>('/admin/integrations');
  },

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------
  async getMetrics() {
    return fetchJson<AdminMetrics>('/admin/metrics');
  },

  // -------------------------------------------------------------------------
  // Email Templates
  // -------------------------------------------------------------------------
  async listEmailTemplates() {
    return fetchJson<{ templates: EmailTemplate[] }>('/admin/email-templates');
  },

  async getEmailTemplate(key: string) {
    return fetchJson<EmailTemplate>(`/admin/email-templates/${key}`);
  },

  async updateEmailTemplate(key: string, input: { subject: string; html_body: string; description?: string }) {
    return fetchJson<{ message: string }>(`/admin/email-templates/${key}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async previewEmailTemplate(key: string, vars?: Record<string, string>) {
    return fetchJson<{ subject: string; html: string }>(`/admin/email-templates/${key}/preview`, {
      method: 'POST',
      body: JSON.stringify({ vars: vars || {} }),
    });
  },

  async testSendEmailTemplate(key: string, input: { to: string; vars?: Record<string, string> }) {
    return fetchJson<{ ok: boolean; id?: string; error?: string }>(
      `/admin/email-templates/${key}/test-send`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  // -------------------------------------------------------------------------
  // Affiliate
  // -------------------------------------------------------------------------
  async getAffiliateFunnel(filters?: AffiliateFunnelFilters) {
    const params = new URLSearchParams();
    if (filters?.house) params.set('house', filters.house);
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    const query = params.toString();
    return fetchJson<{ funnel: AffiliateFunnelRow[]; range: { from: string; to: string } }>(
      `/admin/affiliate/funnel${query ? `?${query}` : ''}`
    );
  },

  async listAffiliateHouses() {
    return fetchJson<{ houses: AffiliateHouse[] }>('/admin/affiliate/houses');
  },

  async createAffiliateHouse(input: AffiliateHouseCreateInput) {
    return fetchJson<{ house: AffiliateHouse }>('/admin/affiliate/houses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateAffiliateHouse(slug: string, input: AffiliateHouseUpdateInput) {
    return fetchJson<{ house: AffiliateHouse }>(`/admin/affiliate/houses/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async listAffiliateCampaigns(houseSlug?: string) {
    const query = houseSlug ? `?house=${encodeURIComponent(houseSlug)}` : '';
    return fetchJson<{ campaigns: AffiliateCampaign[] }>(`/admin/affiliate/campaigns${query}`);
  },

  async createAffiliateCampaign(input: AffiliateCampaignCreateInput) {
    return fetchJson<{ campaign: AffiliateCampaign }>('/admin/affiliate/campaigns', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------
  async listUsers(filters?: AdminUserFilters) {
    const params = new URLSearchParams();
    if (filters?.role) params.set('role', filters.role);
    if (filters?.q) params.set('q', filters.q);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return fetchJson<{ users: AdminUser[] }>(`/admin/users${query ? `?${query}` : ''}`);
  },

  async updateUserRole(id: string, role: 'user' | 'admin' | 'affiliate') {
    return fetchJson<{ user: { id: string; email: string; role: string } }>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  // -------------------------------------------------------------------------
  // Core Houses (canonical)
  // -------------------------------------------------------------------------
  async listCoreHouses() {
    return fetchJson<{ houses: CoreHouse[] }>('/admin/core-houses');
  },

  async createCoreHouse(input: CoreHouseCreateInput) {
    return fetchJson<{ house: CoreHouse }>('/admin/core-houses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateCoreHouse(slug: string, input: CoreHouseUpdateInput) {
    return fetchJson<{ house: CoreHouse }>(`/admin/core-houses/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async deleteCoreHouse(slug: string) {
    return fetchJson<{ deleted: boolean; slug: string }>(`/admin/core-houses/${slug}`, {
      method: 'DELETE',
    });
  },

  // -------------------------------------------------------------------------
  // Promotions
  // -------------------------------------------------------------------------
  async listPromotions(filters?: { house?: string; active?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.house) params.set('house', filters.house);
    if (filters?.active !== undefined) params.set('active', String(filters.active));
    const query = params.toString();
    return fetchJson<{ promotions: Promotion[] }>(`/admin/promotions${query ? `?${query}` : ''}`);
  },

  async createPromotion(input: PromotionCreateInput) {
    return fetchJson<{ promotion: Promotion; tiers: PromotionTier[]; repescagem_source_slugs: string[] }>('/admin/promotions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updatePromotion(slug: string, input: PromotionUpdateInput) {
    return fetchJson<{ promotion: Promotion; tiers: PromotionTier[]; repescagem_source_slugs: string[] }>(`/admin/promotions/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async applyRepescagem(slug: string) {
    return fetchJson<{ invitations_created: number; applied_at: string }>(`/admin/promotions/${slug}/apply-repescagem`, {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });
  },

  async listRaffles(filters?: { active?: boolean; without_promotion?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.active !== undefined) params.set('active', String(filters.active));
    if (filters?.without_promotion !== undefined) params.set('without_promotion', String(filters.without_promotion));
    const query = params.toString();
    return fetchJson<{ raffles: RaffleSummary[] }>(`/admin/raffles${query ? `?${query}` : ''}`);
  },
};

// ============================================================================
// Types - Core Houses & Promotions
// ============================================================================

export interface CoreHouse {
  id: string;
  slug: string;
  name: string;
  country: string;
  currency: string;
  deposit_url: string;
  signup_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CoreHouseCreateInput {
  slug: string;
  name: string;
  country: string;
  currency: string;
  deposit_url: string;
  signup_url?: string;
  active?: boolean;
}

export interface CoreHouseUpdateInput {
  name?: string;
  country?: string;
  currency?: string;
  deposit_url?: string;
  signup_url?: string;
  active?: boolean;
}

export interface PromotionTier {
  min_deposit_cents: number;
  tickets: number;
}

export interface Promotion {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creative_url: string | null;
  house_id: string;
  house_slug: string;
  house_name: string;
  raffle_id: string;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  repescagem: boolean;
  repescagem_applied_at: string | null;
  active: boolean;
  tiers: PromotionTier[];
  repescagem_source_slugs: string[];
  created_at: string;
  updated_at: string;
}

export interface PromotionCreateInput {
  slug: string;
  name: string;
  description?: string;
  creative_url?: string;
  house_slug: string;
  raffle_id: string;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  tiers: PromotionTier[];
  repescagem_source_slugs?: string[];
  active?: boolean;
}

export interface PromotionUpdateInput {
  name?: string;
  description?: string;
  creative_url?: string;
  ends_at?: string;
  draw_at?: string;
  active?: boolean;
  tiers?: PromotionTier[];
  repescagem_source_slugs?: string[];
}

export interface RaffleSummary {
  id: string;
  name: string;
  prize: string;
  draw_date: string;
  status: string;
}