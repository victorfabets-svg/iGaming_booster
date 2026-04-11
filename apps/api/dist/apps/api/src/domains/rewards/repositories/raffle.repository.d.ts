export interface Raffle {
    id: string;
    name: string;
    prize: string;
    total_numbers: number;
    draw_date: Date;
    status: string;
}
export declare function findRaffleById(id: string): Promise<Raffle | null>;
export declare function findActiveRaffle(): Promise<Raffle | null>;
export declare function createRaffle(input: {
    name: string;
    prize: string;
    total_numbers: number;
    draw_date: Date;
    status: string;
}): Promise<Raffle>;
export declare function updateRaffleStatus(id: string, status: string): Promise<void>;
//# sourceMappingURL=raffle.repository.d.ts.map