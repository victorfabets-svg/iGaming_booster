import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { fetchFunnelTotals, WindowKey } from '../../domains/validation/repositories/funnel-metrics.repository';
import { fail } from '../utils/response';

const VALID_WINDOWS: WindowKey[] = ['1h', '6h', '24h', '7d', '30d'];

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function safeDiv(num: number, den: number): number {
  return den === 0 ? 0 : round4(num / den);
}

function intervalToMs(w: WindowKey): number {
  const map: Record<WindowKey, number> = {
    '1h':  3_600_000,
    '6h':  21_600_000,
    '24h': 86_400_000,
    '7d':  604_800_000,
    '30d': 2_592_000_000,
  };
  return map[w];
}

export async function metricsFunnelRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/metrics/funnel', async (
    request: FastifyRequest<{ Querystring: { window?: string } }>,
    reply: FastifyReply
  ) => {
    const userId = (request as any).userId;
    if (!userId) {
      return fail(reply, 'Unauthorized', 'UNAUTHORIZED');
    }

    const raw = ((request.query as any).window ?? '24h').toLowerCase() as WindowKey;
    if (!VALID_WINDOWS.includes(raw)) {
      return fail(reply, `Invalid window. Allowed: ${VALID_WINDOWS.join(', ')}`, 'VALIDATION_ERROR');
    }

    const totals = await fetchFunnelTotals(raw);
    const terminal = totals.approved + totals.rejected + totals.manual_review;

    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - intervalToMs(raw));

    return reply.send({
      window: raw,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      totals: {
        submitted: totals.submitted,
        approved: totals.approved,
        rejected: totals.rejected,
        manual_review: totals.manual_review,
        processing: totals.processing,
        pending: totals.pending,
      },
      rates: {
        approval_rate:      safeDiv(totals.approved,      terminal),
        rejection_rate:     safeDiv(totals.rejected,      terminal),
        manual_review_rate: safeDiv(totals.manual_review, terminal),
        terminal_rate:      safeDiv(terminal,             totals.submitted),
      },
      avg_processing_time_ms: terminal === 0 ? null : totals.avg_processing_time_ms,
    });
  });
}