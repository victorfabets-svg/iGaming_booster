import pg from 'pg';
export declare function getDb(): pg.Pool;
export declare function initDb(connectionString?: string): Promise<void>;
export declare const db: {
    query: <T = any>(text: string, params?: unknown[]) => Promise<{
        rows: T[];
    }>;
    end: () => Promise<void>;
};
export declare function connectWithRetry(maxRetries?: number, delayMs?: number): Promise<void>;
//# sourceMappingURL=connection.d.ts.map