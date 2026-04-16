import pg from 'pg';
export declare const db: pg.Pool;
export declare function connectWithRetry(retries?: number, delayMs?: number): Promise<void>;
//# sourceMappingURL=connection.d.ts.map