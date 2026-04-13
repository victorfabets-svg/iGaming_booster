import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './StorageService';
/**
 * R2 Storage Adapter
 * Implements StorageService using Cloudflare R2 (S3-compatible API)
 * Domain-agnostic, generic implementation
 */
export declare class R2StorageAdapter implements StorageService {
    private client;
    private bucket;
    constructor(client?: S3Client);
    /**
     * Upload a file buffer to R2 Storage
     * @param file - The file content as a Buffer
     * @param path - The target path within the storage bucket
     * @param contentType - The MIME type of the file
     */
    upload(file: Buffer, path: string, contentType: string): Promise<{
        key: string;
    }>;
    /**
     * Get the public URL for an uploaded file
     */
    getPublicUrl(path: string): string;
    /**
     * Generate a signed URL for downloading a file
     * @param path - The path within the storage bucket
     * @param expiresIn - Expiration time in seconds (default 300)
     */
    getSignedUrl(path: string, expiresIn?: number): Promise<string>;
}
export declare function getStorageService(): StorageService;
export declare function getR2StorageService(): R2StorageAdapter;
//# sourceMappingURL=R2StorageAdapter.d.ts.map