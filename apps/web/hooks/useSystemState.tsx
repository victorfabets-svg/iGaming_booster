import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

// Types for the system state
export interface Reward {
  id: string;
  user_id: string;
  proof_id: string;
  type: string;
  status: 'pending' | 'granted' | 'expired';
  created_at: string;
}

export interface Ticket {
  id: string;
  user_id: string;
  raffle_id: string;
  number: number;
  reward_id: string;
  created_at: string;
}

export interface Raffle {
  id: string;
  name: string;
  prize: string;
  total_numbers: number;
  draw_date: string;
  status: 'active' | 'executed' | 'closed';
}

export interface RaffleResult {
  id: string;
  raffle_id: string;
  winning_number: number;
  winner_user_id: string | null;
  winner_ticket_id: string | null;
  executed_at: string;
}

export interface Proof {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export interface SystemState {
  // Current proof being processed
  currentProof: Proof | null;
  
  // Rewards
  rewards: Reward[];
  rewardsLoading: boolean;
  rewardsError: string | null;
  
  // Tickets
  tickets: Ticket[];
  ticketsLoading: boolean;
  ticketsError: string | null;
  
  // Raffles
  raffles: Raffle[];
  rafflesLoading: boolean;
  rafflesError: string | null;
  
  // Results
  results: RaffleResult[];
  resultsLoading: boolean;
  resultsError: string | null;
  
  // Actions
  setCurrentProof: (proof: Proof | null) => void;
}

const SystemStateContext = createContext<SystemState | null>(null);

export const SystemStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentProof, setCurrentProof] = useState<Proof | null>(null);
  
  // Rewards state
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  
  // Tickets state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  
  // Raffles state
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [rafflesLoading, setRafflesLoading] = useState(false);
  const [rafflesError, setRafflesError] = useState<string | null>(null);
  
  // Results state
  const [results, setResults] = useState<RaffleResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const value: SystemState = {
    currentProof,
    rewards,
    rewardsLoading,
    rewardsError,
    tickets,
    ticketsLoading,
    ticketsError,
    raffles,
    rafflesLoading,
    rafflesError,
    results,
    resultsLoading,
    resultsError,
    setCurrentProof,
  };

  return (
    <SystemStateContext.Provider value={value}>
      {children}
    </SystemStateContext.Provider>
  );
};

export const useSystemState = (): SystemState => {
  const context = useContext(SystemStateContext);
  if (!context) {
    throw new Error('useSystemState must be used within a SystemStateProvider');
  }
  return context;
};

export default useSystemState;