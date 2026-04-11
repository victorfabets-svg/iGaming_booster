import { Pool } from 'pg';
export declare const pool: Pool;
export declare function query<T>(text: string, params?: unknown[]): Promise<T[]>;
export declare function queryOne<T>(text: string, params?: unknown[]): Promise<T | null>;
export declare function execute(text: string, params?: unknown[]): Promise<number>;
export declare function closePool(): Promise<void>;
//# sourceMappingURL=database.d.ts.map