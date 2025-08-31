/**
 * Response Formatter - Optimizes responses for AI consumption
 */

import { ActionResult, AIResponse } from '../types';
import { PlayCloneError, normalizeError } from './errors';
import { ResponseSize, createOptimizer } from '../optimization/ResponseOptimizer';

// Global optimizer instance
const optimizer = createOptimizer(ResponseSize.SMALL);

/**
 * Format response for minimal token usage
 */
export function formatResponse(result: ActionResult): ActionResult {
  // Remove null/undefined values to save tokens
  const cleaned = Object.entries(result).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined) {
      (acc as any)[key] = value;
    }
    return acc;
  }, {} as ActionResult);

  // Apply optimization if enabled
  const optimized = optimizer.optimize(cleaned);
  return optimized.compressed ? optimized.result : cleaned;
}

/**
 * Compress large responses for AI consumption
 */
export function compressResponse(data: any, maxSize: number = 1024): AIResponse {
  const jsonStr = JSON.stringify(data);
  const size = new TextEncoder().encode(jsonStr).length;

  if (size <= maxSize) {
    return {
      result: data,
      size,
      compressed: false,
    };
  }

  // Implement compression strategies
  let compressed = data;

  // Strategy 1: Remove verbose fields
  if (data.metadata) {
    compressed = { ...compressed };
    delete compressed.metadata;
  }

  // Strategy 2: Truncate arrays
  if (Array.isArray(compressed)) {
    compressed = compressed.slice(0, 10);
  }

  // Strategy 3: Summarize text content
  if (typeof compressed === 'string' && compressed.length > maxSize) {
    compressed = compressed.substring(0, maxSize - 20) + '...[truncated]';
  }

  // Strategy 4: For objects, keep only essential fields
  if (typeof compressed === 'object' && !Array.isArray(compressed)) {
    const essential = ['success', 'action', 'error', 'value', 'url', 'title', 'text'];
    compressed = Object.entries(compressed).reduce((acc, [key, value]) => {
      if (essential.includes(key)) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
  }

  const compressedSize = new TextEncoder().encode(JSON.stringify(compressed)).length;

  return {
    result: compressed,
    size: compressedSize,
    compressed: true,
  };
}

/**
 * Format error responses consistently
 */
export function formatError(
  error: Error | string | PlayCloneError,
  action: string,
  context?: { selector?: string; url?: string }
): ActionResult {
  // Normalize the error to PlayCloneError
  let playCloneError: PlayCloneError;
  
  if (typeof error === 'string') {
    playCloneError = new PlayCloneError(error, 'GENERIC_ERROR', {
      action,
      ...context,
    });
  } else if (error instanceof PlayCloneError) {
    playCloneError = error;
  } else {
    playCloneError = normalizeError(error, { action, ...context });
  }

  // Create AI-optimized error response
  const result: ActionResult = {
    success: false,
    action: action || playCloneError.action || 'unknown',
    error: playCloneError.message,
    timestamp: Date.now(),
  };

  // Add additional context for AI debugging
  if (playCloneError.code) {
    result.errorCode = playCloneError.code;
  }
  
  if (playCloneError.suggestion) {
    result.suggestion = playCloneError.suggestion;
  }
  
  if (playCloneError.retryable) {
    result.retryable = true;
  }
  
  if (playCloneError.selector) {
    result.selector = playCloneError.selector;
  }
  
  if (playCloneError.url) {
    result.url = playCloneError.url;
  }

  // Keep response compact
  return formatResponse(result);
}

/**
 * Create a standardized success response
 */
export function formatSuccess(action: string, value?: any, target?: string): ActionResult {
  const result: ActionResult = {
    success: true,
    action,
    timestamp: Date.now(),
  };

  if (value !== undefined) result.value = value;
  if (target !== undefined) result.target = target;

  return result;
}