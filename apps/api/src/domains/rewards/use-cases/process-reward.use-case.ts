import { findValidationByProofId } from '../../validation/repositories/proof-validation.repository';
import { findProofById as findProofByIdInValidation } from '../../validation/repositories/proof.repository';
import { findRewardByProofId, createReward, findRewardById } from '../repositories/reward.repository';
import { createTicket, findTicketByRaffleAndNumber, countTicketsByRewardId } from '../repositories/ticket.repository';
import { findBenefitRuleByAmount, findDynamicBenefitRule } from '../repositories/benefit-rule.repository';
import { findActiveRaffle, createRaffle } from '../repositories/raffle.repository';
import { createRewardEconomics } from '../repositories/reward-economics.repository';
import { createEvent } from '../../../../../../shared/events/event.repository';
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
    await createEvent({
      event_type: 'fraud_flag_detected',
      version: 'v1',
      payload: {
        user_id: payload.user_id,
        proof_id: payload.proof_id,
        signal_type: 'reward_limit_exceeded',
        reason: rewardLimitCheck.reason,
      },
      producer: 'rewards',
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
    
    await createEvent({
      event_type: 'fraud_flag_detected',
      version: 'v1',
      payload: {
        user_id: payload.user_id,
        proof_id: payload.proof_id,
        signal_type: 'high_risk_behavior',
        signals: behaviorCheck.signals,
        risk_score_modifier: behaviorCheck.risk_score_modifier,
      },
      producer: 'rewards',
    });
  }

  // Step 5: Get proof details for amount
  const proof = await findProofByIdInValidation(payload.proof_id);
  if (!proof) {
    throw new Error(`Proof not found: ${payload.proof_id}`);
  }

  // Emit reward_created event
  await createEvent({
    event_type: 'reward_created',
    version: 'v1',
    payload: {
      proof_id: payload.proof_id,
      user_id: payload.user_id,
    },
    producer: 'rewards',
  });

  if (!shouldGrantReward) {
    console.log(`🚫 Reward not granted due to risk assessment: ${downgradeReason}`);
    return;
  }

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

  // Step 7: Create reward (status = "granted")
  const reward = await createReward({
    user_id: payload.user_id,
    proof_id: payload.proof_id,
    type: 'raffle_ticket',
    status: 'granted',
  });

  console.log(`✅ Created reward: ${reward.id}`);

  // Step 8: Calculate and store economics
  const costPerTicket = config.rewards?.costPerTicket || 0.50; // Default $0.50 per ticket
  const estimatedRevenuePerTicket = config.rewards?.revenuePerTicket || 2.00; // Default $2.00 per ticket
  
  const totalCost = effectiveNumbers * costPerTicket;
  const estimatedRevenue = effectiveNumbers * estimatedRevenuePerTicket;
  
  await createRewardEconomics({
    reward_id: reward.id,
    cost: totalCost,
    estimated_revenue: estimatedRevenue,
  });
  
  logger.info('reward_economics_recorded', 'rewards', `Economics recorded for reward: ${reward.id}`, payload.user_id, {
    reward_id: reward.id,
    tickets_generated: effectiveNumbers,
    cost: totalCost,
    estimated_revenue: estimatedRevenue,
    margin: estimatedRevenue - totalCost,
    experiment_variant: experimentVariant,
  });

  // Record metrics
  recordReward('granted');
  alertMonitor.recordRewardGranted();
  logger.info('reward_granted', 'rewards', `Reward granted: ${reward.id}`, payload.user_id, { 
    reward_id: reward.id, 
    proof_id: payload.proof_id,
    benefit_rule: effectiveNumbers,
    experiment_variant: experimentVariant,
  });

  // Record reward in rate limit
  await rateLimitService.recordRewardGranted(payload.user_id);

  // Emit reward_granted event
  await createEvent({
    event_type: 'reward_granted',
    version: 'v1',
    payload: {
      reward_id: reward.id,
      proof_id: payload.proof_id,
      user_id: payload.user_id,
      type: reward.type,
    },
    producer: 'rewards',
  });

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

  // Emit numbers_generated event
  await createEvent({
    event_type: 'numbers_generated',
    version: 'v1',
    payload: {
      reward_id: reward.id,
      proof_id: payload.proof_id,
      user_id: payload.user_id,
      raffle_id: raffle.id,
      tickets: ticketsGenerated,
      count: ticketsGenerated.length,
    },
    producer: 'rewards',
  });

  console.log(`🎫 Generated ${ticketsGenerated.length} tickets: ${ticketsGenerated.join(', ')}`);
  console.log(`✨ Reward processing completed for proof: ${payload.proof_id}`);
}