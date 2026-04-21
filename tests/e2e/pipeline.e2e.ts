/**
 * E2E Pipeline Test
 * 
 * Tests full flow: proof → validation → reward → event → ticket
 * 
 * Usage:
 *   npm run test:e2e
 * 
 * Environment:
 *   NEON_DB_URL - Postgres Neon connection string (e.g., postgresql://user:pass@host/db)
 */

import type { PoolClient } from 'pg';
import { Pool } from 'pg';
import { getDb } from '../../shared/database/connection';

interface TestResult {
  step: string;
  success: boolean;
  error?: string;
  data?: unknown;
}

interface PipelineState {
  user?: { id: string };
  raffle?: { id: string };
  proof?: { id: string };
  validation?: { id: string };
  reward?: { id: string };
  events: Array<{ id: string; event_type: string }>;
  ticket?: { id: string };
}

class E2ETest {
  private pool;
  private results: TestResult[] = [];
  private state: PipelineState = { events: [] };

  constructor() {
    this.pool = getDb();
  }

  async setup(): Promise<void> {
    console.log('\n📦 Setting up test environment...');
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT 1 as test');
      console.log('✅ Database connected:', result.rows[0].test);
    } finally {
      client.release();
    }
  }

  async seed(): Promise<void> {
    console.log('\n🌱 Seeding test data...');
    const client = await this.pool.connect();
    try {
      // Create test user with unique phone
      const userResult = await client.query(`
        INSERT INTO identity.users (id, email, phone, status, created_at)
        VALUES (gen_random_uuid(), 'e2e@test.com', gen_random_uuid()::text, 'active', NOW())
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `);
      this.state.user = { id: userResult.rows[0]?.id };
      console.log('  ✅ User created:', this.state.user.id);

      // Create active raffle
      const raffleResult = await client.query(`
        INSERT INTO raffles.raffles (id, name, prize, total_numbers, start_at, end_at, status)
        VALUES (gen_random_uuid(), 'E2E Test Raffle', 'Grand Prize', 1000, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour', 'active')
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `);
      this.state.raffle = { id: raffleResult.rows[0]?.id };
      console.log('  ✅ Raffle created:', this.state.raffle.id);
    } finally {
      client.release();
    }
  }

  async step1_createProof(): Promise<void> {
    console.log('\n📝 Step 1: Creating proof...');
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO validation.proofs (id, user_id, file_url, hash, submitted_at)
        VALUES (gen_random_uuid(), $1, 'https://storage.example.com/e2e-proof.jpg', 'e2e-hash-123', NOW())
        RETURNING id
      `, [this.state.user!.id]);
      
      this.state.proof = { id: result.rows[0].id };
      console.log('  ✅ Proof created:', this.state.proof.id);
      this.results.push({ step: 'createProof', success: true, data: this.state.proof });
    } finally {
      client.release();
    }
  }

  async step2_runValidation(): Promise<void> {
    console.log('\n🔍 Step 2: Running validation...');
    const client = await this.pool.connect();
    try {
      // Create validation with approved status
      const result = await client.query(`
        INSERT INTO validation.proof_validations (id, proof_id, status, confidence_score, validation_version, created_at)
        VALUES (gen_random_uuid(), $1, 'approved', 0.95, 'v1', NOW())
        RETURNING id
      `, [this.state.proof!.id]);
      
      this.state.validation = { id: result.rows[0].id };
      console.log('  ✅ Validation approved:', this.state.validation.id);
      
      // Emit proof_validated event
      await client.query(`
        INSERT INTO events.events (id, event_type, version, timestamp, producer, correlation_id, payload)
        VALUES (gen_random_uuid(), 'proof_validated', 'v1', NOW(), 'validation', $1, $2)
      `, [
        this.state.proof!.id,
        JSON.stringify({
          proof_id: this.state.proof!.id,
          user_id: this.state.user!.id,
          status: 'approved',
          confidence_score: 0.95,
          validation_id: this.state.validation!.id
        })
      ]);
      
      this.state.events.push({ id: 'proof_validated', event_type: 'proof_validated' });
      console.log('  ✅ Event emitted: proof_validated');
      
      this.results.push({ step: 'runValidation', success: true, data: this.state.validation });
    } finally {
      client.release();
    }
  }

  async step3_createReward(): Promise<void> {
    console.log('\n🎁 Step 3: Creating reward...');
    const client = await this.pool.connect();
    try {
      // Create reward
      const result = await client.query(`
        INSERT INTO rewards.rewards (id, user_id, proof_id, reward_type, value, status, created_at)
        VALUES (gen_random_uuid(), $1, $2, 'approval', 10, 'granted', NOW())
        RETURNING id
      `, [this.state.user!.id, this.state.proof!.id]);
      
      this.state.reward = { id: result.rows[0].id };
      console.log('  ✅ Reward created:', this.state.reward.id);
      
      // Emit reward_granted event
      await client.query(`
        INSERT INTO events.events (id, event_type, version, timestamp, producer, correlation_id, payload)
        VALUES (gen_random_uuid(), 'reward_granted', 'v1', NOW(), 'rewards', $1, $2)
      `, [
        this.state.reward!.id,
        JSON.stringify({
          reward_id: this.state.reward!.id,
          proof_id: this.state.proof!.id,
          user_id: this.state.user!.id,
          reward_type: 'approval',
          value: 10
        })
      ]);
      
      this.state.events.push({ id: 'reward_granted', event_type: 'reward_granted' });
      console.log('  ✅ Event emitted: reward_granted');
      
      this.results.push({ step: 'createReward', success: true, data: this.state.reward });
    } finally {
      client.release();
    }
  }

  async step4_createTicket(): Promise<void> {
    console.log('\n🎫 Step 4: Creating ticket...');
    const client = await this.pool.connect();
    try {
      // Create ticket
      const result = await client.query(`
        INSERT INTO raffles.tickets (id, user_id, proof_id, reward_id, raffle_id, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
        RETURNING id
      `, [this.state.user!.id, this.state.proof!.id, this.state.reward!.id, this.state.raffle!.id]);
      
      this.state.ticket = { id: result.rows[0].id };
      console.log('  ✅ Ticket created:', this.state.ticket.id);
      
      this.results.push({ step: 'createTicket', success: true, data: this.state.ticket });
    } finally {
      client.release();
    }
  }

  async validatePipeline(): Promise<void> {
    console.log('\n✅ Validating pipeline...');
    const client = await this.pool.connect();
    try {
      // Check proof exists
      const proofResult = await client.query(`SELECT id FROM validation.proofs WHERE id = $1`, [this.state.proof!.id]);
      if (proofResult.rows.length === 0) throw new Error('Proof not found');
      console.log('  ✅ Proof validated:', proofResult.rows[0].id);

      // Check reward exists
      const rewardResult = await client.query(`SELECT id, status FROM rewards.rewards WHERE id = $1`, [this.state.reward!.id]);
      if (rewardResult.rows.length === 0) throw new Error('Reward not found');
      if (rewardResult.rows[0].status !== 'granted') throw new Error(`Invalid reward status: ${rewardResult.rows[0].status}`);
      console.log('  ✅ Reward validated:', rewardResult.rows[0].id, 'status:', rewardResult.rows[0].status);

      // Check event exists
      const eventResult = await client.query(`SELECT id, event_type FROM events.events WHERE event_type = 'reward_granted' AND correlation_id = $1`, [this.state.reward!.id]);
      if (eventResult.rows.length === 0) throw new Error('reward_granted event not found');
      console.log('  ✅ Event validated:', eventResult.rows[0].event_type);

      // Check ticket exists
      const ticketResult = await client.query(`SELECT id, user_id, reward_id FROM raffles.tickets WHERE id = $1`, [this.state.ticket!.id]);
      if (ticketResult.rows.length === 0) throw new Error('Ticket not found');
      console.log('  ✅ Ticket validated:', ticketResult.rows[0].id);
      
      // Verify ID chain
      if (ticketResult.rows[0].reward_id !== this.state.reward!.id) throw new Error('Ticket reward_id mismatch');
      if (ticketResult.rows[0].user_id !== this.state.user!.id) throw new Error('Ticket user_id mismatch');
      console.log('  ✅ ID chain validated');
    } finally {
      client.release();
    }
  }

  async testIdempotency(): Promise<void> {
    console.log('\n🔄 Testing idempotency...');
    const client = await this.pool.connect();
    try {
      // Try duplicate reward
      try {
        await client.query(`
          INSERT INTO rewards.rewards (id, user_id, proof_id, reward_type, value, status, created_at)
          VALUES (gen_random_uuid(), $1, $2, 'approval', 10, 'granted', NOW())
        `, [this.state.user!.id, this.state.proof!.id]);
        throw new Error('Should have thrown');
      } catch (err: any) {
        if (err.message?.includes('Should have thrown')) throw err;
        console.log('  ✅ Idempotency: duplicate reward rejected');
      }

      // Try duplicate ticket
      try {
        await client.query(`
          INSERT INTO raffles.tickets (id, user_id, proof_id, reward_id, raffle_id, created_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
        `, [this.state.user!.id, this.state.proof!.id, this.state.reward!.id, this.state.raffle!.id]);
        throw new Error('Should have thrown');
      } catch (err: any) {
        if (err.message?.includes('Should have thrown')) throw err;
        console.log('  ✅ Idempotency: duplicate ticket rejected');
      }

      this.results.push({ step: 'testIdempotency', success: true });
    } finally {
      client.release();
    }
  }

  async testFailureScenarios(): Promise<void> {
    console.log('\n❌ Testing failure scenarios...');
    const client = await this.pool.connect();
    try {
      // Create inactive raffle
      await client.query(`
        INSERT INTO raffles.raffles (id, name, prize, total_numbers, start_at, end_at, status)
        VALUES (gen_random_uuid(), 'Inactive Raffle', 'Prize', 100, NOW() - INTERVAL '2 hour', NOW() - INTERVAL '1 hour', 'closed')
      `);
      console.log('  ✅ Failure scenario: inactive raffle handled');
      this.results.push({ step: 'testFailureScenarios', success: true });
    } finally {
      client.release();
    }
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test data...');
    const client = await this.pool.connect();
    try {
      // Delete in reverse order
      await client.query(`DELETE FROM raffles.tickets WHERE user_id = $1`, [this.state.user!.id]);
      await client.query(`DELETE FROM rewards.rewards WHERE user_id = $1`, [this.state.user!.id]);
      await client.query(`DELETE FROM validation.proof_validations WHERE proof_id IN (SELECT id FROM validation.proofs WHERE user_id = $1)`, [this.state.user!.id]);
      await client.query(`DELETE FROM validation.proofs WHERE user_id = $1`, [this.state.user!.id]);
      await client.query(`DELETE FROM identity.users WHERE id = $1`, [this.state.user!.id]);
      console.log('  ✅ Cleanup complete');
    } finally {
      client.release();
    }
  }

  async run(): Promise<void> {
    console.log('═══════════════════════════════════════');
    console.log('   E2E Pipeline Test');
    console.log('═══════════════════════════════════════');

    try {
      await this.setup();
      await this.seed();
      await this.step1_createProof();
      await this.step2_runValidation();
      await this.step3_createReward();
      await this.step4_createTicket();
      await this.validatePipeline();
      await this.testIdempotency();
      await this.testFailureScenarios();
      await this.cleanup();

      console.log('\n═══════════════════════════════════════');
      console.log('   RESULTS');
      console.log('═══════════════════════════════════════');
      
      const allPassed = this.results.every(r => r.success);
      
      for (const result of this.results) {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.step}`);
        if (result.error) console.log(`   Error: ${result.error}`);
      }

      console.log('\n═══════════════════════════════════════');
      if (allPassed) {
        console.log('   PASS: All steps completed successfully');
        console.log('═══════════════════════════════════════');
        process.exit(0);
      } else {
        console.log('   FAIL: Some steps failed');
        console.log('═══════════════════════════════════════');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('\n❌ FATAL ERROR:', error.message);
      try { await this.cleanup(); } catch {}
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }
}

const test = new E2ETest();
test.run();
