/**
 * Anthropic Vision OCR Provider
 * Extracts receipt data using Claude Haiku with vision capabilities.
 * 
 * FIX-2: raw_text extraction
 * FIX-5: model alias (not dated)
 * FIX-10: hash computed from content, not URL
 * FIX-11: timeout on SDK call  
 * FIX-12: proper error code mapping
 * FIX-13: real Haiku pricing ($1/M input, $5/M output)
 */

import Anthropic from '@anthropic-ai/sdk';
import { OcrProvider, OcrInput, OcrResult } from './ocr-provider.interface';
import { db } from '@shared/database/connection';
import { logger } from '@shared/observability/logger';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

// FIX-5: alias instead of dated ID
const MODEL_NAME = 'claude-haiku-4-5';

// Tool input schema with raw_text (FIX-2)
const EXTRACT_RECEIPT_TOOL = {
  name: 'extract_receipt',
  description: 'Extract structured receipt data from a payment proof image',
  input_schema: {
    type: 'object',
    properties: {
      raw_text: {
        type: 'string',
        description: 'Full text extracted from the receipt image, verbatim',
      },
      amount: {
        type: 'number',
        description: 'The payment amount extracted from the receipt',
      },
      payment_identifier: {
        type: 'string',
        description: 'Transaction ID, reference number, or payment identifier from the receipt',
      },
      currency: {
        type: 'string',
        description: 'Currency code (e.g., USD, EUR, GBP)',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score from 0 to 1',
      },
    },
    required: ['raw_text', 'amount', 'payment_identifier', 'currency', 'confidence'],
  },
} as const;

export class AnthropicOcrProvider implements OcrProvider {
  readonly name = 'anthropic';

  private client: Anthropic;
  private model = MODEL_NAME;
  private maxRetries = 1;
  private timeoutMs = 30_000;

  constructor(apiKey: string) {
    // FIX-11: timeout on SDK
    this.client = new Anthropic({
      apiKey,
      maxRetries: this.maxRetries,
      timeout: this.timeoutMs,
    });
  }

  async extract(input: OcrInput): Promise<OcrResult> {
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let fileHash = '';

    try {
      // FIX-10: fetch and compute hash from content
      const { base64, hash } = await this.fetchImageAsBase64(input.file_url);
      fileHash = hash;
      const mediaType = this.getMediaType(input.file_url);

      // Make the API call with message create
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        tools: [EXTRACT_RECEIPT_TOOL],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: 'Extract the receipt data from this image. Return the full visible text in raw_text, plus structured fields: amount, payment_identifier, currency, confidence.',
              },
            ],
          },
        ],
      });

      // Extract usage info
      if (response.usage) {
        inputTokens = response.usage.input_tokens || 0;
        outputTokens = response.usage.output_tokens || 0;
      }

      // Parse tool use result
      const toolUse = response.content.find(
        (block) => block.type === 'tool_use' && block.name === 'extract_receipt'
      );

      if (!toolUse || toolUse.type !== 'tool_use') {
        return await this.recordOcrCall({
          proof_id: input.proof_id,
          startTime,
          inputTokens,
          outputTokens,
          status: 'error',
          errorCode: 'no_tool_result',
          fileHash,
        });
      }

      const toolInput = toolUse.input as {
        raw_text?: string;
        amount?: number;
        payment_identifier?: string;
        currency?: string;
        confidence?: number;
      };

      // FIX-2: extract raw_text with sanitization (5000 char max)
      let rawText = '';
      if (typeof toolInput.raw_text === 'string') {
        rawText = toolInput.raw_text.slice(0, 5000);
      }

      const amount = typeof toolInput.amount === 'number' ? toolInput.amount : null;
      const paymentIdentifier =
        typeof toolInput.payment_identifier === 'string'
          ? toolInput.payment_identifier
          : null;
      const currency =
        typeof toolInput.currency === 'string' ? toolInput.currency : null;
      const confidence =
        typeof toolInput.confidence === 'number'
          ? Math.max(0, Math.min(1, toolInput.confidence))
          : 0;

      // FIX-13: real Haiku pricing ($1/M input, $5/M output)
      // https://www.anthropic.com/pricing
      const costUsd =
        (inputTokens / 1_000_000) * 1.0 + (outputTokens / 1_000_000) * 5.0;

      // Record successful OCR call
      await this.recordOcrCall({
        proof_id: input.proof_id,
        startTime,
        inputTokens,
        outputTokens,
        costUsd,
        status: 'success',
        fileHash,
      });

      return {
        amount,
        payment_identifier: paymentIdentifier,
        raw_text: rawText,
        confidence,
        currency,
        status: 'success',
      };
    } catch (error: unknown) {
      const errorAny = error as { name?: string; status?: number; message?: string };
      const isTimeout = errorAny?.name === 'AbortError' || /timeout/i.test(errorAny?.message || '');
      
      // FIX-12: proper error code mapping
      let errorCode = 'unknown';
      if (isTimeout) {
        errorCode = 'timeout';
      } else if (errorAny?.status) {
        if (errorAny.status >= 400 && errorAny.status < 500) {
          errorCode = `http_${errorAny.status}`;
        } else if (errorAny.status >= 500) {
          errorCode = `http_${errorAny.status}`;
        }
      }

      logger.error('ocr_anthropic_error', 'validation', String(error));

      // Record failed OCR call
      await this.recordOcrCall({
        proof_id: input.proof_id,
        startTime,
        inputTokens,
        outputTokens,
        status: isTimeout ? 'timeout' : 'error',
        errorCode,
        fileHash,
      });

      return {
        amount: null,
        payment_identifier: null,
        raw_text: '',
        confidence: 0,
        currency: null,
        status: isTimeout ? 'timeout' : 'error',
        reason: errorAny?.message || (isTimeout ? 'timeout' : 'OCR extraction failed'),
      };
    }
  }

  private async fetchImageAsBase64(url: string): Promise<{ base64: string; hash: string }> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`fetch failed ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // FIX-10: hash from content
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    return { base64: buffer.toString('base64'), hash };
  }

  private getMediaType(url: string): 'image/jpeg' | 'image/png' {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith('.png') || lowerUrl.includes('.png?')) {
      return 'image/png';
    }
    return 'image/jpeg';
  }

  private async recordOcrCall(params: {
    proof_id?: string;
    startTime: number;
    inputTokens: number;
    outputTokens: number;
    costUsd?: number;
    status: 'success' | 'error' | 'timeout';
    errorCode?: string;
    fileHash: string;
  }): Promise<OcrResult> {
    const durationMs = Date.now() - params.startTime;

    try {
      await db.query(
        `INSERT INTO validation.ocr_calls 
         (id, proof_id, file_hash, provider, model, input_tokens, output_tokens, cost_usd, duration_ms, status, error_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          randomUUID(),
          params.proof_id || null,
          params.fileHash,
          this.name,
          this.model,
          params.inputTokens,
          params.outputTokens,
          params.costUsd || null,
          durationMs,
          params.status,
          params.errorCode || null,
        ]
      );
    } catch (recordError) {
      logger.error('ocr_call_record_failed', 'validation', String(recordError));
    }

    // Return sentinel based on status
    if (params.status === 'timeout') {
      return {
        amount: null,
        payment_identifier: null,
        raw_text: '',
        confidence: 0,
        currency: null,
        status: 'timeout',
        reason: 'OCR request timed out',
      };
    }

    return {
      amount: null,
      payment_identifier: null,
      raw_text: '',
      confidence: 0,
      currency: null,
      status: 'error',
      reason: params.errorCode || 'OCR extraction failed',
    };
  }
}
