export interface PaymentSignal {
    id: string;
    proof_id: string;
    type: string;
    value: string;
    confidence: number | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
}
export interface CreatePaymentSignalInput {
    proof_id: string;
    type: string;
    value: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
}
export declare function createPaymentSignal(input: CreatePaymentSignalInput): Promise<PaymentSignal>;
export declare function findPaymentSignalsByProofId(proofId: string): Promise<PaymentSignal[]>;
export declare function findPaymentSignalByProofAndType(proofId: string, type: string): Promise<PaymentSignal | null>;
export declare function countPaymentSignalsByProof(proofId: string): Promise<number>;
//# sourceMappingURL=payment-signal.repository.d.ts.map