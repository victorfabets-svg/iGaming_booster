// API domain wrapper - delegates to domain layer
import { closeRaffle } from '../../../domains/raffles/application/close-raffle';

/**
 * Close raffle handler - API layer wrapper.
 * Delegates to domain layer for full implementation.
 */
export async function closeRaffleHandler(raffleId: string): Promise<boolean> {
  return closeRaffle(raffleId);
}