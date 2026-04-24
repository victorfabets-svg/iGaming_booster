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
   * @returns The storage key/path of the uploaded file
   */
  upload(file: Buffer, path: string, contentType: string): Promise<{ key: string }>;

  /**
   * Read a file back from storage by its key.
   * @returns file bytes + content type when found; null when the key doesn't exist.
   *          Any other failure throws.
   */
  download(key: string): Promise<{ buffer: Buffer; contentType: string } | null>;
}