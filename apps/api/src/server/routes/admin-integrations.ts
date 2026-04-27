/**
 * Admin Integrations Route
 * Read-only view of integration environment variables (admin role required)
 * Also includes GET /admin/metrics for dashboard KPIs
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { requireAdmin } from '../../infrastructure/auth/require-admin';
import { listAll as listPartnerHouses } from '../../domains/validation/repositories/partner-houses.repository';
import { listAll as listPlans } from '../../domains/subscription/plans.repository';
import { listAll as listSubscriptions, SubscriptionFilters } from '../../domains/subscription/subscriptions.repository';
import { db } from '@shared/database/connection';
import { ok } from '../utils/response';

export interface IntegrationConfig {
  key: string;
  label: string;
  category: 'ocr' | 'whatsapp' | 'tipster' | 'subscription' | 'storage' | 'security';
  configured: boolean;
  masked_value: string | null;
  description: string;
  edit_url: string;
}

/**
 * Get integrations config (excludes sensitive values)
 */
function getIntegrations(): IntegrationConfig[] {
  const dashboardBase = process.env.RENDER_DASHBOARD_URL || 'https://dashboard.render.com';
  const isConfigured = (key: string): boolean => {
    const value = process.env[key];
    return typeof value === 'string' && value.length > 0;
  };
  const maskValue = (key: string): string | null => {
    const value = process.env[key];
    if (!value || typeof value !== 'string' || value.length < 8) {
      return null;
    }
    return value.substring(0, 4) + '…' + value.substring(value.length - 4);
  };

  return [
    {
      key: 'ANTHROPIC_API_KEY',
      label: 'Anthropic (OCR)',
      category: 'ocr',
      configured: isConfigured('ANTHROPIC_API_KEY'),
      masked_value: maskValue('ANTHROPIC_API_KEY'),
      description: 'OCR via Claude vision',
      edit_url: `${dashboardBase}/web/env`,
    },
    {
      key: 'TIPSTER_API_KEY',
      label: 'Tipster API',
      category: 'tipster',
      configured: isConfigured('TIPSTER_API_KEY'),
      masked_value: maskValue('TIPSTER_API_KEY'),
      description: 'Bearer key external tipster systems use to POST tips',
      edit_url: `${dashboardBase}/web/env`,
    },
    {
      key: 'WHATSAPP_PLATFORM_API_KEY',
      label: 'WhatsApp Platform',
      category: 'whatsapp',
      configured: isConfigured('WHATSAPP_PLATFORM_API_KEY'),
      masked_value: maskValue('WHATSAPP_PLATFORM_API_KEY'),
      description: 'Bearer key WhatsApp BSP webhooks use',
      edit_url: `${dashboardBase}/web/env`,
    },
    {
      key: 'SUBSCRIPTION_PLATFORM_API_KEY',
      label: 'Subscription Platform',
      category: 'subscription',
      configured: isConfigured('SUBSCRIPTION_PLATFORM_API_KEY'),
      masked_value: maskValue('SUBSCRIPTION_PLATFORM_API_KEY'),
      description: 'Bearer key subscription provider webhooks use',
      edit_url: `${dashboardBase}/web/env`,
    },
    {
      key: 'AWS_ACCESS_KEY_ID',
      label: 'AWS S3',
      category: 'storage',
      configured: isConfigured('AWS_ACCESS_KEY_ID') && isConfigured('AWS_SECRET_ACCESS_KEY'),
      masked_value: maskValue('AWS_ACCESS_KEY_ID'),
      description: 'S3 file storage',
      edit_url: `${dashboardBase}/web/env`,
    },
    {
      key: 'JWT_SECRET',
      label: 'JWT Secret',
      category: 'security',
      configured: isConfigured('JWT_SECRET'),
      masked_value: null, // Always null for security
      description: 'JWT signing secret',
      edit_url: `${dashboardBase}/web/env`,
    },
  ];
}

/**
 * Get dashboard metrics (counts of houses, plans, subscriptions, etc.)
 */
async function getMetrics(): Promise<{
  houses_count: number;
  plans_count: number;
  active_subscriptions_count: number;
  active_subscribers_count: number;
}> {
  const houses = await listPartnerHouses();
  const plans = await listPlans();
  const activePlans = plans.filter(p => p.active);
  
  // Get subscriptions for all active plan slugs
  const filters: SubscriptionFilters = {};
  filters.status = 'active';
  const activeSubs = await listSubscriptions(filters);
  
  // Filter to only active plans in JS
  const activePlanSlugSet = new Set(activePlans.map(p => p.slug));
  const filteredSubs = activeSubs.filter(sub => activePlanSlugSet.has(sub.plan_slug));
  
  // Count unique active subscribers
  const subscriberIds = new Set<string>();
  for (const sub of filteredSubs) {
    if (sub.user_id) {
      subscriberIds.add(sub.user_id);
    }
  }

  return {
    houses_count: houses.length,
    plans_count: activePlans.length,
    active_subscriptions_count: filteredSubs.length,
    active_subscribers_count: subscriberIds.size,
  };
}

export async function adminIntegrationsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // GET /admin/integrations - List integrations
  fastify.get(
    '/admin/integrations',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const integrations = getIntegrations();
      return ok(reply, { integrations });
    }
  );

  // GET /admin/metrics - Get dashboard KPIs
  fastify.get(
    '/admin/metrics',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const metrics = await getMetrics();
      return ok(reply, metrics);
    }
  );
}