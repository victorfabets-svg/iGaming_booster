export interface ExecuteRaffleDrawInput {
    raffle_id: string;
}
export interface ExecuteRaffleDrawResult {
    raffle_id: string;
    winning_number: number;
    user_id: string;
    seed: string;
}
export declare function executeRaffleDraw(input: ExecuteRaffleDrawInput): Promise<ExecuteRaffleDrawResult>;
//# sourceMappingURL=execute-raffle-draw.use-case.d.ts.map