export interface RaffleDraw {
    id: string;
    raffle_id: string;
    seed: string;
    algorithm: string;
    result_number: number;
    winner_user_id: string | null;
    winner_ticket_id: string | null;
    executed_at: Date;
}
export interface CreateRaffleDrawInput {
    raffle_id: string;
    seed: string;
    algorithm: string;
    result_number: number;
}
export declare function createRaffleDraw(input: CreateRaffleDrawInput): Promise<RaffleDraw>;
export declare function findRaffleDrawByRaffleId(raffleId: string): Promise<RaffleDraw | null>;
export declare function updateRaffleDrawWinner(drawId: string, winnerUserId: string, winnerTicketId: string): Promise<void>;
export declare function markRaffleExecuted(raffleId: string): Promise<void>;
//# sourceMappingURL=raffle-draw.repository.d.ts.map