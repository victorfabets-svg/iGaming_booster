import { pool, queryOne, query } from '../../../lib/database';

export interface RiskSignal {
  id: string;
  user_id: string;
  signal_type: string;
  value: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface CreateRiskSignalInput {
  user_id: string;
  signal_type: string;
  value: string;
  metadata?: Record<string, unknown>;
}

export async function createRiskSignal(input: CreateRiskSignalInput): Promise<RiskSignal> {
  const result = await pool.query(
    `INSERT INTO fraud.risk_signals (user_id, signal_type, value, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, signal_type, value, metadata, created_at`,
    [input.user_id, input.signal_type, input.value, input.metadata ? JSON.stringify(input.metadata) : null]
  );
  return result.rows[0];
}

export async function findRiskSignalsByUserId(userId: string, limit: number = 100): Promise<RiskSignal[]> {
  return await query<RiskSignal>(
    `SELECT id, user_id, signal_type, value, metadata, created_at
     FROM fraud.risk_signals
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
}

export async function findRiskSignalsByType(signalType: string, since: Date): Promise<RiskSignal[]> {
  return await query<RiskSignal>(
    `SELECT id, user_id, signal_type, value, metadata, created_at
     FROM fraud.risk_signals
     WHERE signal_type = $1 AND created_at >= $2
     ORDER BY created_at DESC`,
    [signalType, since]
  );
}

export async function countRiskSignalsByUser(userId: string, signalType?: string, since?: Date): Promise<number> {
  let sql = `SELECT COUNT(*) as count FROM fraud.risk_signals WHERE user_id = $1`;
  const params: unknown[] = [userId];

  if (signalType) {
    sql += ` AND signal_type = $2`;
    params.push(signalType);
  }
  if (since) {
    const idx = signalType ? 3 : 2;
    sql += ` AND created_at >= $${idx}`;
    params.push(since);
  }

  const result = await queryOne<{ count: string }>(sql, params);
  return parseInt(result?.count || '0', 10);
}