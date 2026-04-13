/**
 * Storage Service Interface
 * Defines the contract for file storage operations
 * Domain-agnostic, generic storage abstraction
 */
export interface StorageService {
  /**
   * Upload a file buffer to storage
   * @param file - The file content as a Buffer
   * @param path - The target path within the storage bucket
   * @param contentType - The MIME type of the file
   * @returns The public URL of the uploaded file
   */
  upload(file: Buffer, path: string, contentType: string): Promise<string>;
}