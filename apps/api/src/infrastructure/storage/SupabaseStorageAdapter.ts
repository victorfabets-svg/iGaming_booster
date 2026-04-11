import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from './StorageService';

/**
 * Supabase Storage Configuration
 */
interface SupabaseStorageConfig {
  url: string;
  key: string;
  bucket: string;
  publicUrlBase: string;
}

function getStorageConfig(): SupabaseStorageConfig {
  return {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '',
    bucket: process.env.STORAGE_BUCKET || 'proofs',
    publicUrlBase: process.env.STORAGE_PUBLIC_URL_BASE || '',
  };
}

/**
 * Supabase Storage Adapter
 * Implements StorageService using Supabase Storage
 * Domain-agnostic, generic implementation
 */
export class SupabaseStorageAdapter implements StorageService {
  private client: SupabaseClient;
  private bucket: string;
  private publicUrlBase: string;

  constructor(client?: SupabaseClient) {
    const config = getStorageConfig();
    
    // Use provided client or create new one
    this.client = client || createClient(config.url, config.key);
    this.bucket = config.bucket;
    this.publicUrlBase = config.publicUrlBase;
  }

  /**
   * Upload a file buffer to Supabase Storage
   * @param file - The file content as a Buffer
   * @param path - The target path within the storage bucket
   * @param contentType - The MIME type of the file
   */
  async upload(file: Buffer, path: string, contentType: string): Promise<string> {
    // Upload to Supabase Storage
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .upload(path, file, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('[STORAGE] Upload failed:', error.message);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    console.log('[STORAGE] File uploaded:', data.path);

    // Get public URL
    return this.getPublicUrl(path);
  }

  /**
   * Get the public URL for an uploaded file
   */
  private getPublicUrl(path: string): string {
    // If custom public URL base is configured, use it
    if (this.publicUrlBase) {
      return `${this.publicUrlBase}/${path}`;
    }

    // Otherwise, get from Supabase
    const { data } = this.client.storage
      .from(this.bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }
}

/**
 * Create a singleton instance of the storage adapter
 */
let storageInstance: SupabaseStorageAdapter | null = null;

export function getStorageService(): StorageService {
  if (!storageInstance) {
    storageInstance = new SupabaseStorageAdapter();
  }
  return storageInstance;
}