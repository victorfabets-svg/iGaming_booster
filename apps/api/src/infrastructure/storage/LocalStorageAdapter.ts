import * as fs from 'fs/promises';
import * as nodePath from 'path';
import { StorageService } from './StorageService';

const LOCAL_STORAGE_ROOT = process.env.LOCAL_STORAGE_ROOT || '/tmp/proof-uploads';

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function contentTypeFromExt(ext: string): string {
  return EXT_TO_CONTENT_TYPE[ext.toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Local filesystem storage adapter. Development-only fallback used when R2
 * credentials are absent. Writes files under LOCAL_STORAGE_ROOT (default
 * /tmp/proof-uploads) and returns the original key so downstream code
 * (worker, audit log) stays unchanged.
 */
export class LocalStorageAdapter implements StorageService {
  async upload(file: Buffer, key: string, contentType: string): Promise<{ key: string }> {
    const target = nodePath.join(LOCAL_STORAGE_ROOT, key);
    await fs.mkdir(nodePath.dirname(target), { recursive: true });
    await fs.writeFile(target, file);
    console.log(`[LocalStorage] wrote ${file.length} bytes (${contentType}) → ${target}`);
    return { key };
  }

  async download(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const target = nodePath.join(LOCAL_STORAGE_ROOT, key);
    try {
      const buffer = await fs.readFile(target);
      return { buffer, contentType: contentTypeFromExt(nodePath.extname(key)) };
    } catch (err: any) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }
}
