/**
 * Anthropic Vision OCR Provider
 * Extracts receipt data using Claude Haiku with vision capabilities.
 */

import Anthropic from '@anthropic-ai/sdk';
import { OcrProvider, OcrInput, OcrResult } from './ocr-provider.interface';
import { db } from '@shared/database/connection';
import { logger } from '@shared/observability/logger';
import { randomUUID } from 'crypto';

// Tool input schema for structured extraction
const EXTRACT_RECEIPT_TOOL = {
  name: 'extract_receipt',
  description: 'Extract structured receipt data from a payment proof image',
  input_schema: {
    type: 'object',
    properties: {
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
    required: ['amount', 'payment_identifier', 'currency', 'confidence'],
  },
} as const;

export class AnthropicOcrProvider implements OcrProvider {
  readonly name = 'anthropic';

  private client: Anthropic;
  private model = 'claude-haiku-4-5-20250929';
  private maxRetries = 1;
  private timeoutMs = 30_000;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      maxRetries: this.maxRetries,
    });
  }

  async extract(input: OcrInput): Promise<OcrResult> {
    const startTime = Date.now();
    let rawText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      // Fetch image from URL and convert to base64
      const imageBase64 = await this.fetchImageAsBase64(input.file_url);
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
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: 'Extract the receipt data from this payment proof image. Return the amount, payment identifier (transaction ID or reference), currency, and confidence score.',
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
          input,
          startTime,
          inputTokens,
          outputTokens,
          status: 'error',
          errorCode: 'no_tool_result',
          fileHash: input.file_hash,
          provider: this.name,
          model: this.model,
        });
      }

      const toolInput = toolUse.input as {
        amount?: number;
        payment_identifier?: string;
        currency?: string;
        confidence?: number;
      };

      // Validate and extract results
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

      // Calculate cost (Haiku pricing: $0.0002/1K input, $0.0002/1K output)
      const costUsd =
        (inputTokens * 0.0002) / 1000 + (outputTokens * 0.0002) / 1000;

      // Record successful OCR call
      await this.recordOcrCall({
        input,
        startTime,
        inputTokens,
        outputTokens,
        costUsd,
        status: 'success',
        fileHash: input.file_hash,
        provider: this.name,
        model: this.model,
      });

      return {
        amount,
        payment_identifier: paymentIdentifier,
        raw_text: '',
        confidence,
        currency,
        status: 'success',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout =
        errorMessage.includes('timeout') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('timed out');

      logger.error('ocr_anthropic_error', 'validation', errorMessage);

      // Determine error code
      let errorCode = 'unknown';
      if (isTimeout) {
        errorCode = 'timeout';
      } else if (errorMessage.includes('4')) {
        errorCode = 'client_error';
      } else if (errorMessage.includes('5')) {
        errorCode = 'server_error';
      }

      // Record failed OCR call
      await this.recordOcrCall({
        input,
        startTime,
        inputTokens,
        outputTokens,
        status: isTimeout ? 'timeout' : 'error',
        errorCode,
        fileHash: input.file_hash,
        provider: this.name,
        model: this.model,
      });

      return {
        amount: null,
        payment_identifier: null,
        raw_text: '',
        confidence: 0,
        currency: null,
        status: isTimeout ? 'timeout' : 'error',
        reason: errorMessage,
      };
    }
  }

  private async fetchImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  }

  private getMediaType(url: string): 'image/jpeg' | 'image/png' {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith('.png') || lowerUrl.includes('.png?')) {
      return 'image/png';
    }
    return 'image/jpeg';
  }

  private async recordOcrCall(params: {
    input: OcrInput;
    startTime: number;
    inputTokens: number;
    outputTokens: number;
    costUsd?: number;
    status: 'success' | 'error' | 'timeout';
    errorCode?: string;
    fileHash: string;
    provider: string;
    model: string;
  }): Promise<OcrResult> {
    const durationMs = Date.now() - params.startTime;

    try {
      await db.query(
        `INSERT INTO validation.ocr_calls 
         (id, proof_id, file_hash, provider, model, input_tokens, output_tokens, cost_usd, duration_ms, status, error_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          randomUUID(),
          params.input.proof_id || null,
          params.fileHash,
          params.provider,
          params.model,
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