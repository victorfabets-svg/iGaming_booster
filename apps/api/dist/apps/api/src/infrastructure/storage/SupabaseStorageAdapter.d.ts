import { SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from './StorageService';
/**
 * Supabase Storage Adapter
 * Implements StorageService using Supabase Storage
 * Domain-agnostic, generic implementation
 */
export declare class SupabaseStorageAdapter implements StorageService {
    private client;
    private bucket;
    private publicUrlBase;
    constructor(client?: SupabaseClient);
    /**
     * Upload a file buffer to Supabase Storage
     * @param file - The file content as a Buffer
     * @param path - The target path within the storage bucket
     * @param contentType - The MIME type of the file
     */
    upload(file: Buffer, path: string, contentType: string): Promise<string>;
    /**
     * Get the public URL for an uploaded file
     */
    private getPublicUrl;
}
export declare function getStorageService(): StorageService;
//# sourceMappingURL=SupabaseStorageAdapter.d.ts.map