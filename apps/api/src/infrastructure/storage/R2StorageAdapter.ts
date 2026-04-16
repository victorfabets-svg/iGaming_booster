import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './StorageService';
import { config } from 'shared/config/env';

/**
 * R2 Storage Configuration
 */
interface R2StorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
}

function getR2Config(): R2StorageConfig {
  const { storage } = config;
  return {
    endpoint: storage.r2Endpoint,
    accessKeyId: storage.r2AccessKeyId,
    secretAccessKey: storage.r2SecretAccessKey,
    bucket: storage.r2Bucket,
    region: storage.r2Region,
  };
}

/**
 * R2 Storage Adapter
 * Implements StorageService using Cloudflare R2 (S3-compatible API)
 * Domain-agnostic, generic implementation
 */
export class R2StorageAdapter implements StorageService {
  private client: S3Client;
  private bucket: string;

  constructor(client?: S3Client) {
    const config = getR2Config();
    
    // Use provided client or create new one
    this.client = client || new S3Client({
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
  async upload(file: Buffer, path: string, contentType: string): Promise<{ key: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: file,
        ContentType: contentType,
      });

      await this.client.send(command);
      console.log('[R2] File uploaded:', path);

      // Return the storage key
      return { key: path };
    } catch (error) {
      // Log the error for debugging
      const err = error as Error;
      console.error('[R2] Upload failed:', err.message);
      
      // Re-throw a controlled error with user-friendly message
      throw new Error(`Storage upload failed: ${err.message}`);
    }
  }

  /**
   * Get the public URL for an uploaded file
   */
  getPublicUrl(path: string): string {
    const config = getR2Config();
    // R2 public URL format
    return `${config.endpoint}/${this.bucket}/${path}`;
  }

  /**
   * Generate a signed URL for downloading a file
   * @param path - The path within the storage bucket
   * @param expiresIn - Expiration time in seconds (default 300)
   */
  async getSignedUrl(path: string, expiresIn: number = 300): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: path,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      // Log the error for debugging
      const err = error as Error;
      console.error('[R2] Signed URL generation failed:', err.message);
      
      // Re-throw a controlled error with user-friendly message
      throw new Error(`Signed URL generation failed: ${err.message}`);
    }
  }
}

/**
 * Create a singleton instance of the storage adapter
 */
let storageInstance: R2StorageAdapter | null = null;

export function getStorageService(): StorageService {
  if (!storageInstance) {
    storageInstance = new R2StorageAdapter();
  }
  return storageInstance;
}

// Export the typed R2 adapter for signed URLs
export function getR2StorageService(): R2StorageAdapter {
  if (!storageInstance) {
    storageInstance = new R2StorageAdapter();
  }
  return storageInstance;
}