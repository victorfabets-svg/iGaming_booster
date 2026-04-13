export interface OcrResult {
    amount: number;
    date: string;
    institution: string;
    identifier: string | null;
}
/**
 * Mock OCR Service
 * Returns deterministic mock data based on file_url hash
 */
export declare function extractTextFromImage(fileUrl: string): OcrResult;
//# sourceMappingURL=ocr.service.d.ts.map