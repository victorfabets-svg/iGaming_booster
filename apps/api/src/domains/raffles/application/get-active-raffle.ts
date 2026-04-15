// API domain wrapper - delegates to domain layer
import { getActiveRaffle, getRaffleById } from '../../../domains/raffles/application/get-active-raffle';
export { closeRaffle } from '../../../domains/raffles/application/close-raffle';

export interface Raffle {
  id: string;
  name: string;
  prize: string;
  total_numbers: number;
  start_at: Date;
  end_at: Date;
  status: 'pending' | 'active' | 'closed' | 'completed';
}

export { getActiveRaffle, getRaffleById };