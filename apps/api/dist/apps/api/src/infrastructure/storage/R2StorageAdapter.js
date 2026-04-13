"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2StorageAdapter = void 0;
exports.getStorageService = getStorageService;
exports.getR2StorageService = getR2StorageService;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
function getR2Config() {
    return {
        endpoint: process.env.R2_ENDPOINT || '',
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        bucket: process.env.R2_BUCKET || 'igamingbooster',
        region: process.env.R2_REGION || 'auto',
    };
}
/**
 * R2 Storage Adapter
 * Implements StorageService using Cloudflare R2 (S3-compatible API)
 * Domain-agnostic, generic implementation
 */
class R2StorageAdapter {
    constructor(client) {
        const config = getR2Config();
        // Use provided client or create new one
        this.client = client || new client_s3_1.S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
            // R2 requires path-style addressing
            forcePathStyle: true,
        });
        this.bucket = config.bucket;
    }
    /**
     * Upload a file buffer to R2 Storage
     * @param file - The file content as a Buffer
     * @param path - The target path within the storage bucket
     * @param contentType - The MIME type of the file
     */
    async upload(file, path, contentType) {
        try {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucket,
                Key: path,
                Body: file,
                ContentType: contentType,
            });
            await this.client.send(command);
            console.log('[R2] File uploaded:', path);
            // Return the public URL (R2 with public access)
            return this.getPublicUrl(path);
        }
        catch (error) {
            // Log the error for debugging
            const err = error;
            console.error('[R2] Upload failed:', err.message);
            // Re-throw a controlled error with user-friendly message
            throw new Error(`Storage upload failed: ${err.message}`);
        }
    }
    /**
     * Get the public URL for an uploaded file
     */
    getPublicUrl(path) {
        const config = getR2Config();
        // R2 public URL format
        return `${config.endpoint}/${this.bucket}/${path}`;
    }
    /**
     * Generate a signed URL for downloading a file
     * @param path - The path within the storage bucket
     * @param expiresIn - Expiration time in seconds (default 300)
     */
    async getSignedUrl(path, expiresIn = 300) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucket,
                Key: path,
            });
            return await (0, s3_request_presigner_1.getSignedUrl)(this.client, command, { expiresIn });
        }
        catch (error) {
            // Log the error for debugging
            const err = error;
            console.error('[R2] Signed URL generation failed:', err.message);
            // Re-throw a controlled error with user-friendly message
            throw new Error(`Signed URL generation failed: ${err.message}`);
        }
    }
}
exports.R2StorageAdapter = R2StorageAdapter;
/**
 * Create a singleton instance of the storage adapter
 */
let storageInstance = null;
function getStorageService() {
    if (!storageInstance) {
        storageInstance = new R2StorageAdapter();
    }
    return storageInstance;
}
// Export the typed R2 adapter for signed URLs
function getR2StorageService() {
    if (!storageInstance) {
        storageInstance = new R2StorageAdapter();
    }
    return storageInstance;
}
//# sourceMappingURL=R2StorageAdapter.js.map