import { findValidationByProofId } from '../../validation/repositories/proof-validation.repository';
import { findProofById as findProofByIdInValidation } from '../../validation/repositories/proof.repository';
import { findRewardByProofId, createReward, createRewardTx, findRewardById } from '../repositories/reward.repository';
import { createTicket, findTicketByRaffleAndNumber, countTicketsByRewardId } from '../repositories/ticket.repository';
import { findBenefitRuleByAmount, findDynamicBenefitRule } from '../repositories/benefit-rule.repository';
import { findActiveRaffle, createRaffle } from '../repositories/raffle.repository';
import { withTransactionalOutbox, queueEventInTransaction, insertAuditInTransaction } from '../../../../../../shared/events/transactional-outbox';
import { rateLimitService } from '../../fraud/services/rate-limit.service';
import { behaviorAnalysisService } from '../../fraud/services/behavior.service';
import { logger, alertMonitor } from '../../../../../../shared/observability/logger';
import { recordReward, recordTicketGenerated } from '../../../../../../shared/observability/metrics.service';
import { isRewardsEnabled } from '../../../../../../shared/config/feature-flags';
import { config } from '../../../../../../shared/config/env';
import { experimentService } from '../services/experiment.service';

export interface ProofValidatedEventPayload {
  proof_id: string;
  user_id: string;
  file_url: string;
  submitted_at: string;
  validation_id: string;
  status: string;
  confidence_score: number;
}

const MAX_TICKET_GENERATION_ATTEMPTS = 10;

export async function processReward(payload: ProofValidatedEventPayload): Promise<void> {
  console.log(`🎁 Processing reward for proof: ${payload.proof_id}`);
  console.log(`   Validation status: ${payload.status}, confidence: ${payload.confidence_score}`);

  // Check if rewards are enabled
  if (!isRewardsEnabled()) {
    logger.warn('rewards_disabled', 'rewards', 'Rewards are currently disabled', payload.user_id, { proof_id: payload.proof_id });
    console.log(`⚠️  Rewards are disabled, skipping reward`);
    return;
  }

  logger.info('reward_started', 'rewards', `Processing reward for proof: ${payload.proof_id}`, payload.user_id, { 
    proof_id: payload.proof_id, 
    validation_status: payload.status 
  });

  // Step 1: Check if validation is approved
  if (payload.status !== 'approved') {
    console.log(`⏭️  Validation not approved, skipping reward`);
    return;
  }

  // Step 2: Check if reward already exists (idempotency)
  const existingReward = await findRewardByProofId(payload.proof_id);
  if (existingReward) {
    console.log(`⏭️  Reward already exists for proof: ${payload.proof_id}, skipping`);
    return;
  }

  // Step 3: Check reward rate limit
  const rewardLimitCheck = await rateLimitService.checkRewardLimit(payload.user_id);
  if (!rewardLimitCheck.allowed) {
    console.log(`⚠️  Reward rate limit exceeded for user: ${payload.user_id}`);
    await withTransactionalOutbox(async (txnId) => {
      queueEventInTransaction(txnId, 'fraud_flag_detected', {
        user_id: payload.user_id,
        proof_id: payload.proof_id,
        signal_type: 'reward_limit_exceeded',
        reason: rewardLimitCheck.reason,
      }, 'rewards');
    });
    return;
  }

  // Step 4: Check behavior patterns for abuse
  const behaviorCheck = await behaviorAnalysisService.analyzeBehavior(payload.user_id, payload.proof_id);
  let shouldGrantReward = true;
  let downgradeReason: string | null = null;

  if (behaviorCheck.is_suspicious && behaviorCheck.risk_score_modifier > 0.4) {
    // High risk - downgraded to manual review or reject
    shouldGrantReward = false;
    downgradeReason = `High risk behavior: ${behaviorCheck.signals.join(', ')}`;
    console.log(`⚠️  High risk detected, not granting reward: ${downgradeReason}`);
    
    await withTransactionalOutbox(async (txnId) => {
      queueEventInTransaction(txnId, 'fraud_flag_detected', {
        user_id: payload.user_id,
        proof_id: payload.proof_id,
        signal_type: 'high_risk_behavior',
        signals: behaviorCheck.signals,
        risk_score_modifier: behaviorCheck.risk_score_modifier,
      }, 'rewards');
    });
  }

  // Step 5: Get proof details for amount
  const proof = await findProofByIdInValidation(payload.proof_id);
  if (!proof) {
    throw new Error(`Proof not found: ${payload.proof_id}`);
  }

  // Check risk first - if high risk, don't create reward
  if (!shouldGrantReward) {
    console.log(`🚫 Reward not granted due to risk assessment: ${downgradeReason}`);
    return;
  }

  // AUDIT FIX: EVENT FLOW - Only proceed if shouldGrantReward is true

  // Step 6: Get experiment variant for this user
  const experimentVariant = await experimentService.assignUserToExperiment(payload.user_id, 'reward_tickets');
  console.log(`🧪 Experiment variant: ${experimentVariant}`);
  logger.info('experiment_assigned', 'rewards', `Assigned to experiment: reward_tickets`, payload.user_id, { 
    experiment: 'reward_tickets', 
    variant: experimentVariant 
  });

  // Step 7: Select benefit rule - check dynamic rules first
  const mockAmount = payload.confidence_score * 100; // 0-100 based on confidence
  
  // Check if we should use dynamic rule based on experiment variant
  let benefitRule = null;
  if (experimentVariant !== 'control') {
    benefitRule = await findDynamicBenefitRule(mockAmount);
  }
  
  // Fall back to standard rule if no dynamic rule or in control group
  if (!benefitRule) {
    benefitRule = await findBenefitRuleByAmount(mockAmount);
  }
  
  if (!benefitRule) {
    console.log(`⚠️  No benefit rule found for amount: ${mockAmount}`);
    return;
  }

  // Apply risk multiplier if configured
  let effectiveNumbers = benefitRule.numbers_generated;
  if (benefitRule.risk_multiplier && benefitRule.risk_multiplier !== 1.0) {
    const riskModifier = behaviorCheck.risk_score_modifier || 0;
    effectiveNumbers = Math.max(1, Math.floor(benefitRule.numbers_generated * (1 - riskModifier * (benefitRule.risk_multiplier - 1))));
  }

  console.log(`📋 Using benefit rule: ${effectiveNumbers} tickets (base: ${benefitRule.numbers_generated}, multiplier: ${benefitRule.risk_multiplier || 1}), ${benefitRule.access_days} days`);

  // Step 7: Create reward with transaction safety
  const REWARD_VALUE = 10;
  const REWARD_TYPE = 'approval';
  
  // Calculate economics values before transaction
  const costPerTicket = config.rewards?.costPerTicket || 0.50;
  const estimatedRevenuePerTicket = config.rewards?.revenuePerTicket || 2.00;

  const totalCost = effectiveNumbers * costPerTicket;
  const estimatedRevenue = effectiveNumbers * estimatedRevenuePerTicket;

  // Use transactional outbox for atomic reward creation + event emission
  const reward = await withTransactionalOutbox(async (client) => {
    // Create reward
    const createdReward = await createRewardTx({
      user_id: payload.user_id,
      proof_id: payload.proof_id,
      reward_type: REWARD_TYPE,
      value: REWARD_VALUE,
    }, client);

    // Create reward economics
    await client.query(
      `INSERT INTO rewards.reward_economics (reward_id, cost, estimated_revenue)
       VALUES ($1, $2, $3)`,
      [createdReward.id, totalCost, estimatedRevenue]
    );

    // Emit reward_granted event within the same transaction
    await queueEventInTransaction(client, 'reward_granted', {
      reward_id: createdReward.id,
      proof_id: payload.proof_id,
      user_id: payload.user_id,
      reward_type: createdReward.reward_type,
      value: createdReward.value,
    }, 'rewards');

    // Audit: Insert audit log for reward granted
    await insertAuditInTransaction(
      client,
      'reward_granted',
      'reward',
      createdReward.id,
      payload.user_id,
      {
        proof_id: payload.proof_id,
        user_id: payload.user_id,
        value: createdReward.value,
        reward_type: createdReward.reward_type,
        tickets_generated: effectiveNumbers,
      }
    );

    console.log(`✅ Created reward: ${createdReward.id} (within transactional outbox)`);
    return createdReward;
  });
  // Note: Only reward_granted event - reward_created is NOT part of contract

  // Record metrics (outside transaction but after persist)
  recordReward('granted');
  alertMonitor.recordRewardGranted();
  logger.info('reward_granted', 'rewards', `Reward granted: ${reward.id}`, payload.user_id, { 
    reward_id: reward.id, 
    proof_id: payload.proof_id,
    benefit_rule: effectiveNumbers,
    experiment_variant: experimentVariant,
  });

  // Record reward in rate limit (outside transaction)
  await rateLimitService.recordRewardGranted(payload.user_id);

  // Step 8: Get or create active raffle
  let raffle = await findActiveRaffle();
  
  if (!raffle) {
    // Create a default active raffle
    const drawDate = new Date();
    drawDate.setDate(drawDate.getDate() + 30); // 30 days from now
    
    raffle = await createRaffle({
      name: 'Default Raffle',
      prize: 'Grand Prize',
      total_numbers: 1000,
      draw_date: drawDate,
      status: 'active',
    });
    console.log(`🎰 Created new raffle: ${raffle.id}`);
  }

  console.log(`🎰 Using raffle: ${raffle.id}, total numbers: ${raffle.total_numbers}`);

  // Step 9: Generate tickets with retry logic for collisions
  const ticketsGenerated: number[] = [];
  
  for (let i = 0; i < effectiveNumbers; i++) {
    let ticketNumber: number;
    let attempts = 0;
    let ticket = null;

    // Try to generate unique ticket number
    do {
      // Generate deterministic ticket number based on proof_id, reward_id, and iteration
      const seed = parseInt(payload.proof_id.replace(/-/g, '').slice(0, 8), 16) + i;
      ticketNumber = (seed % raffle!.total_numbers) + 1;
      
      ticket = await findTicketByRaffleAndNumber(raffle.id, ticketNumber);
      attempts++;
    } while (ticket && attempts < MAX_TICKET_GENERATION_ATTEMPTS);

    if (ticket) {
      console.log(`⚠️  Failed to generate unique ticket after ${MAX_TICKET_GENERATION_ATTEMPTS} attempts`);
      continue;
    }

    ticket = await createTicket({
      user_id: payload.user_id,
      raffle_id: raffle.id,
      number: ticketNumber,
      reward_id: reward.id,
    });

    ticketsGenerated.push(ticketNumber);
  }

  // Emit numbers_generated event (transactional)
  await withTransactionalOutbox(async (txnId) => {
    queueEventInTransaction(txnId, 'numbers_generated', {
      reward_id: reward.id,
      proof_id: payload.proof_id,
      user_id: payload.user_id,
      raffle_id: raffle.id,
      tickets: ticketsGenerated,
      count: ticketsGenerated.length,
    }, 'rewards');
  });

  console.log(`🎫 Generated ${ticketsGenerated.length} tickets: ${ticketsGenerated.join(', ')}`);
  console.log(`✨ Reward processing completed for proof: ${payload.proof_id}`);
}