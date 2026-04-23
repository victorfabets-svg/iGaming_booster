import * as crypto from 'crypto';
import { getDb, db } from '@shared/database/connection';

export interface ExperimentAssignment {
  id: string;
  user_id: string;
  experiment_name: string;
  variant: string;
  assigned_at: Date;
}

export interface ExperimentConfig {
  name: string;
  variants: string[];
  weights?: number[]; // If not provided, equal distribution
}

const EXPERIMENTS: Record<string, ExperimentConfig> = {
  reward_tickets: {
    name: 'reward_tickets',
    variants: ['control', 'treatment_a', 'treatment_b'],
  },
  // NOTE: validation_threshold experiment removed - thresholds always from config
};

// Deterministic assignment based on user ID
function assignVariant(userId: string, variants: string[], weights?: number[]): string {
  // Create deterministic hash from userId
  const hash = crypto.createHash('sha256').update(userId).digest();
  const num = hash.readUInt32BE(0);
  
  if (!weights || weights.length === 0) {
    // Equal distribution
    return variants[num % variants.length];
  }
  
  // Weighted distribution
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const normalized = (num % 1000) / 1000; // 0-1
  const threshold = normalized * totalWeight;
  
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (threshold < cumulative) {
      return variants[i];
    }
  }
  
  return variants[variants.length - 1];
}

class ExperimentService {
  private static instance: ExperimentService;

  private constructor() {}

  static getInstance(): ExperimentService {
    if (!ExperimentService.instance) {
      ExperimentService.instance = new ExperimentService();
    }
    return ExperimentService.instance;
  }

  async assignUserToExperiment(userId: string, experimentName: string): Promise<string> {
    // Check if user already assigned
    const existing = await db.query<ExperimentAssignment>(
      `SELECT id, user_id, experiment_name, variant, assigned_at
       FROM rewards.experiment_assignments
       WHERE user_id = $1 AND experiment_name = $2`,
      [userId, experimentName]
    ).then(r => r.rows[0] || null);

    if (existing) {
      return existing.variant;
    }

    // Get experiment config
    const config = EXPERIMENTS[experimentName];
    if (!config) {
      // Default to control if experiment not found
      return 'control';
    }

    // Assign new variant
    const variant = assignVariant(userId, config.variants, config.weights);

    // Store assignment
    await getDb().query(
      `INSERT INTO rewards.experiment_assignments (user_id, experiment_name, variant)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, experiment_name) DO NOTHING`,
      [userId, experimentName, variant]
    );

    return variant;
  }

  async getUserVariant(userId: string, experimentName: string): Promise<string | null> {
    const assignment = await db.query<ExperimentAssignment>(
      `SELECT variant FROM rewards.experiment_assignments
       WHERE user_id = $1 AND experiment_name = $2`,
      [userId, experimentName]
    ).then(r => r.rows[0] || null);
    
    return assignment?.variant || null;
  }

  getExperimentConfig(experimentName: string): ExperimentConfig | null {
    return EXPERIMENTS[experimentName] || null;
  }

  getAllExperiments(): ExperimentConfig[] {
    return Object.values(EXPERIMENTS);
  }

  // Get variant distribution stats
  async getExperimentStats(experimentName: string): Promise<Record<string, number>> {
    const result = await db.query<{ variant: string; count: string }>(
      `SELECT variant, COUNT(*) as count
       FROM rewards.experiment_assignments
       WHERE experiment_name = $1
       GROUP BY variant`,
      [experimentName]
    );
    
    const stats: Record<string, number> = {};
    for (const row of result.rows) {
      stats[row.variant] = parseInt(row.count, 10);
    }
    return stats;
  }
}

export const experimentService = ExperimentService.getInstance();

// Helper to get variant with default
export async function getExperimentVariant(
  userId: string,
  experimentName: string,
  defaultVariant: string = 'control'
): Promise<string> {
  const variant = await experimentService.getUserVariant(userId, experimentName);
  return variant || defaultVariant;
}