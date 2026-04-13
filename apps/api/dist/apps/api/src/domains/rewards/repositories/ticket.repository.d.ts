export interface Ticket {
    id: string;
    user_id: string;
    raffle_id: string;
    number: number;
    reward_id: string;
    created_at: Date;
}
export interface CreateTicketInput {
    user_id: string;
    raffle_id: string;
    number: number;
    reward_id: string;
}
export declare function createTicket(input: CreateTicketInput): Promise<Ticket>;
export declare function findTicketByRaffleAndNumber(raffleId: string, number: number): Promise<Ticket | null>;
export declare function findTicketsByRewardId(rewardId: string): Promise<Ticket[]>;
export declare function countTicketsByRewardId(rewardId: string): Promise<number>;
export declare function findTicketsByRaffleId(raffleId: string): Promise<Ticket[]>;
//# sourceMappingURL=ticket.repository.d.ts.map