import { findProofById as findProofByIdInValidation } from '../../validation/repositories/proof.repository';
import { findRewardByProofId, createRewardTx } from '../repositories/reward.repository';
import { findBenefitRuleByAmount, findDynamicBenefitRule } from '../repositories/benefit-rule.repository';
import { withTransactionalOutbox, insertAuditInTransaction, insertEventInTransaction, queueEventInTransaction } from '../../../../../../shared/events/transactional-outbox';
import { rateLimitService } from '../../fraud/services/rate-limit.service';
import { behaviorAnalysisService } from '../../fraud/services/behavior.service';
import { logger, alertMonitor } from '../../../../../../shared/observability/logger';
import { recordReward } from '../../../../../../shared/observability/metrics.service';
import { isRewardsEnabled } from '../../../../../../shared/config/feature-flags';
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

export async function processReward(payload: ProofValidatedEventPayload): Promise<void> {
  logger.info('reward_processing_start', 'rewards', `Processing reward for proof: ${payload.proof_id}, user: ${payload.user_id}, status: ${payload.status}, confidence: ${payload.confidence_score}`, payload.user_id);

  // Check if rewards are enabled
  if (!isRewardsEnabled()) {
    logger.warn('rewards_disabled', 'rewards', 'Rewards are currently disabled', payload.user_id, { proof_id: payload.proof_id });
    return;
  }

  logger.info('reward_started', 'rewards', `Processing reward for proof: ${payload.proof_id}`, payload.user_id, { 
    proof_id: payload.proof_id, 
    validation_status: payload.status 
  });

  // Step 1: Check if validation is approved
  if (payload.status !== 'approved') {
    logger.info('validation_not_approved', 'rewards', `Validation not approved for proof: ${payload.proof_id}, status: ${payload.status}`, payload.user_id);
    return;
  }

  // Step 2: Check if reward already exists (idempotency)
  const existingReward = await findRewardByProofId(payload.proof_id);
  if (existingReward) {
    logger.info('reward_duplicate_detected', 'rewards', `Reward already exists for proof: ${payload.proof_id}, reward_id: ${existingReward.id}`, payload.user_id);
    return;
  }

  // Step 3: Check reward rate limit
  const rewardLimitCheck = await rateLimitService.checkRewardLimit(payload.user_id);
  if (!rewardLimitCheck.allowed) {
    logger.warn('rate_limit_exceeded', 'rewards', 'Reward rate limit exceeded', payload.user_id, { proof_id: payload.proof_id });
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
    logger.warn('high_risk_detected', 'rewards', 'High risk detected, not granting reward', payload.user_id, { 
      proof_id: payload.proof_id,
      signals: behaviorCheck.signals,
      risk_score_modifier: behaviorCheck.risk_score_modifier
    });
    
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
    logger.warn('reward_not_granted_risk', 'rewards', 'Reward not granted due to risk assessment', payload.user_id, { 
      proof_id: payload.proof_id,
      reason: downgradeReason
    });
    return;
  }

  // AUDIT FIX: EVENT FLOW - Only proceed if shouldGrantReward is true

  // Step 6: Get experiment variant for this user
  const experimentVariant = await experimentService.assignUserToExperiment(payload.user_id, 'reward_tickets');
  logger.info('experiment_assigned', 'rewards', 'Assigned to experiment', payload.user_id, { 
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
    logger.warn('no_benefit_rule', 'rewards', 'No benefit rule found', payload.user_id, { 
      proof_id: payload.proof_id,
      amount: mockAmount
    });
    return;
  }

  // Apply risk multiplier if configured
  let effectiveNumbers = benefitRule.numbers_generated;
  if (benefitRule.risk_multiplier && benefitRule.risk_multiplier !== 1.0) {
    const riskModifier = behaviorCheck.risk_score_modifier || 0;
    effectiveNumbers = Math.max(1, Math.floor(benefitRule.numbers_generated * (1 - riskModifier * (benefitRule.risk_multiplier - 1))));
  }

  logger.info('benefit_rule_selected', 'rewards', 'Using benefit rule', payload.user_id, { 
    proof_id: payload.proof_id,
    effective_numbers: effectiveNumbers,
    base_numbers: benefitRule.numbers_generated,
    multiplier: benefitRule.risk_multiplier || 1,
    access_days: benefitRule.access_days
  });

  // Step 7: Create reward with transactional outbox pattern
  const REWARD_VALUE = 10;
  const REWARD_TYPE = 'approval';

  // TRANSACTIONAL OUTBOX: reward + event in SAME transaction
  // This guarantees atomicity: if reward exists, event also exists
  const reward = await withTransactionalOutbox(async (client) => {
    // Step 1: Create reward (persist first)
    const createdReward = await createRewardTx({
      user_id: payload.user_id,
      proof_id: payload.proof_id,
      reward_type: REWARD_TYPE,
      value: REWARD_VALUE,
    }, client);

    // Step 2: Insert event in outbox (same transaction - not published yet)
    await insertEventInTransaction(
      client,
      'reward_granted',
      {
        reward_id: createdReward.id,
        proof_id: payload.proof_id,
        user_id: payload.user_id,
        reward_type: createdReward.reward_type,
        value: createdReward.value,
      },
      'rewards'
    );

    // Step 3: Audit log (same transaction)
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
      }
    );

    logger.info('reward_created', 'rewards', `Reward created: ${createdReward.id}, proof: ${payload.proof_id}, user: ${payload.user_id}, type: ${createdReward.reward_type}, value: ${createdReward.value}`, payload.user_id);
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

  logger.info('reward_processing_completed', 'rewards', `Reward processing completed for proof: ${payload.proof_id}, reward_id: ${reward.id}`, payload.user_id);
}