import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './StorageService';

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
  async upload(file: Buffer, path: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
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
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });

    return getSignedUrl(this.client, command, { expiresIn });
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