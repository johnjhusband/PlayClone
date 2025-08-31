/**
 * Response Optimizer - Advanced token optimization for AI responses
 */

import { AIResponse } from '../types';

/**
 * Abbreviation mappings for common fields
 */
const FIELD_ABBREVIATIONS: Record<string, string> = {
  success: 's',
  action: 'a',
  value: 'v',
  target: 't',
  error: 'e',
  timestamp: 'ts',
  selector: 'sel',
  url: 'u',
  title: 'ti',
  text: 'tx',
  errorCode: 'ec',
  suggestion: 'sg',
  retryable: 'r',
  compressed: 'c',
  elements: 'el',
  attributes: 'at',
  children: 'ch',
  parent: 'p',
  siblings: 'si',
  metadata: 'm',
  headers: 'h',
  cookies: 'ck',
  localStorage: 'ls',
  sessionStorage: 'ss',
  viewport: 'vp',
  userAgent: 'ua',
  pageSource: 'ps',
  screenshot: 'sc',
  network: 'n',
  console: 'cn',
  performance: 'pf',
};

/**
 * Action name abbreviations
 */
const ACTION_ABBREVIATIONS: Record<string, string> = {
  navigate: 'nav',
  click: 'clk',
  fill: 'fil',
  select: 'sel',
  check: 'chk',
  uncheck: 'uch',
  hover: 'hov',
  focus: 'foc',
  type: 'typ',
  press: 'prs',
  screenshot: 'scr',
  extract: 'ext',
  waitFor: 'wt',
  scroll: 'scr',
  reload: 'rld',
  back: 'bck',
  forward: 'fwd',
  getText: 'gtx',
  getTable: 'gtb',
  getLinks: 'glk',
  getFormData: 'gfd',
  saveState: 'sst',
  loadState: 'lst',
};

/**
 * Response size categories
 */
export enum ResponseSize {
  NANO = 256,    // Ultra-compact responses
  MICRO = 512,   // Very small responses
  SMALL = 1024,  // Standard AI-optimized
  MEDIUM = 2048, // Detailed responses
  LARGE = 4096,  // Full responses
}

/**
 * Compression strategies
 */
export enum CompressionStrategy {
  NONE = 'none',
  ABBREVIATE = 'abbreviate',
  MINIFY = 'minify',
  TRUNCATE = 'truncate',
  SUMMARIZE = 'summarize',
  ESSENTIAL = 'essential',
  AGGRESSIVE = 'aggressive',
}

/**
 * Response optimizer configuration
 */
export interface OptimizerConfig {
  targetSize: ResponseSize;
  strategy: CompressionStrategy;
  preserveFields?: string[];
  enableAbbreviation?: boolean;
  enableMinification?: boolean;
  enableSummarization?: boolean;
  maxArrayLength?: number;
  maxStringLength?: number;
  maxDepth?: number;
}

/**
 * Response Optimizer class
 */
export class ResponseOptimizer {
  private config: OptimizerConfig;
  private abbreviationMap: Map<string, string>;
  private reverseMap: Map<string, string>;

  constructor(config: Partial<OptimizerConfig> = {}) {
    this.config = {
      targetSize: ResponseSize.SMALL,
      strategy: CompressionStrategy.MINIFY,
      enableAbbreviation: true,
      enableMinification: true,
      enableSummarization: false,
      maxArrayLength: 10,
      maxStringLength: 100,
      maxDepth: 3,
      ...config,
    };

    // Build abbreviation maps
    this.abbreviationMap = new Map([
      ...Object.entries(FIELD_ABBREVIATIONS),
      ...Object.entries(ACTION_ABBREVIATIONS),
    ]);
    
    this.reverseMap = new Map(
      Array.from(this.abbreviationMap.entries()).map(([k, v]) => [v, k])
    );
  }

  /**
   * Optimize a response for minimal token usage
   */
  optimize(data: any): AIResponse {
    const originalSize = this.calculateSize(data);

    // If already within target, return as-is
    if (originalSize <= this.config.targetSize) {
      return {
        result: data,
        size: originalSize,
        compressed: false,
      };
    }

    // Apply compression strategies based on configuration
    let optimized = data;
    let strategy = this.config.strategy;

    switch (strategy) {
      case CompressionStrategy.NONE:
        break;
      
      case CompressionStrategy.ABBREVIATE:
        optimized = this.abbreviate(optimized);
        break;
      
      case CompressionStrategy.MINIFY:
        optimized = this.minify(optimized);
        break;
      
      case CompressionStrategy.TRUNCATE:
        optimized = this.truncate(optimized);
        break;
      
      case CompressionStrategy.SUMMARIZE:
        optimized = this.summarize(optimized);
        break;
      
      case CompressionStrategy.ESSENTIAL:
        optimized = this.extractEssential(optimized);
        break;
      
      case CompressionStrategy.AGGRESSIVE:
        optimized = this.aggressiveCompress(optimized);
        break;
    }

    const optimizedSize = this.calculateSize(optimized);

    return {
      result: optimized,
      size: optimizedSize,
      compressed: originalSize !== optimizedSize,
      reduction: Math.round((1 - optimizedSize / originalSize) * 100),
    };
  }

  /**
   * Calculate size in bytes
   */
  private calculateSize(data: any): number {
    return new TextEncoder().encode(JSON.stringify(data)).length;
  }

  /**
   * Abbreviate field names
   */
  private abbreviate(data: any, depth: number = 0): any {
    if (depth > this.config.maxDepth!) return data;
    
    if (Array.isArray(data)) {
      return data.slice(0, this.config.maxArrayLength).map(item => 
        this.abbreviate(item, depth + 1)
      );
    }
    
    if (typeof data === 'object' && data !== null) {
      const abbreviated: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        const abbrevKey = this.abbreviationMap.get(key) || key;
        abbreviated[abbrevKey] = this.abbreviate(value, depth + 1);
      }
      
      return abbreviated;
    }
    
    if (typeof data === 'string' && data.length > this.config.maxStringLength!) {
      return data.substring(0, this.config.maxStringLength!) + '...';
    }
    
    return data;
  }

  /**
   * Minify by removing unnecessary fields
   */
  private minify(data: any): any {
    if (Array.isArray(data)) {
      return data.slice(0, this.config.maxArrayLength).map(item => this.minify(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const minified: any = {};
      const skipFields = ['metadata', 'raw', 'debug', '_internal', 'stack'];
      
      for (const [key, value] of Object.entries(data)) {
        // Skip null, undefined, empty arrays/objects
        if (value === null || value === undefined) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        if (typeof value === 'object' && Object.keys(value).length === 0) continue;
        if (skipFields.includes(key)) continue;
        
        // Preserve essential fields
        if (this.config.preserveFields?.includes(key)) {
          minified[key] = value;
        } else {
          minified[key] = this.minify(value);
        }
      }
      
      return minified;
    }
    
    return data;
  }

  /**
   * Truncate large data structures
   */
  private truncate(data: any, depth: number = 0): any {
    if (depth > 2) return '[truncated]';
    
    if (Array.isArray(data)) {
      return data.slice(0, 5).map(item => this.truncate(item, depth + 1));
    }
    
    if (typeof data === 'string' && data.length > 50) {
      return data.substring(0, 50) + '...';
    }
    
    if (typeof data === 'object' && data !== null) {
      const truncated: any = {};
      let count = 0;
      
      for (const [key, value] of Object.entries(data)) {
        if (count >= 5) break;
        truncated[key] = this.truncate(value, depth + 1);
        count++;
      }
      
      if (Object.keys(data).length > count) {
        truncated._more = `+${Object.keys(data).length - count}`;
      }
      
      return truncated;
    }
    
    return data;
  }

  /**
   * Summarize complex data
   */
  private summarize(data: any): any {
    if (Array.isArray(data)) {
      return {
        _type: 'array',
        length: data.length,
        sample: data.slice(0, 3),
      };
    }
    
    if (typeof data === 'string' && data.length > 100) {
      return {
        _type: 'string',
        length: data.length,
        preview: data.substring(0, 100) + '...',
      };
    }
    
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      
      if (keys.length > 10) {
        return {
          _type: 'object',
          keys: keys.slice(0, 5),
          totalKeys: keys.length,
        };
      }
      
      // Recursively summarize nested objects
      const summarized: any = {};
      for (const [key, value] of Object.entries(data)) {
        summarized[key] = this.summarize(value);
      }
      return summarized;
    }
    
    return data;
  }

  /**
   * Extract only essential fields
   */
  private extractEssential(data: any): any {
    const essential = ['success', 's', 'error', 'e', 'value', 'v', 'action', 'a'];
    
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const extracted: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (essential.includes(key) || this.config.preserveFields?.includes(key)) {
          extracted[key] = value;
        }
      }
      
      return extracted;
    }
    
    return data;
  }

  /**
   * Aggressive compression - maximum space saving
   */
  private aggressiveCompress(data: any): any {
    // First abbreviate
    let compressed = this.abbreviate(data);
    
    // Then minify
    compressed = this.minify(compressed);
    
    // Then extract essential
    compressed = this.extractEssential(compressed);
    
    // Finally truncate if still too large
    if (this.calculateSize(compressed) > this.config.targetSize) {
      compressed = this.truncate(compressed);
    }
    
    return compressed;
  }

  /**
   * Expand abbreviated response (for debugging)
   */
  expand(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.expand(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const expanded: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        const expandedKey = this.reverseMap.get(key) || key;
        expanded[expandedKey] = this.expand(value);
      }
      
      return expanded;
    }
    
    return data;
  }

  /**
   * Get optimal configuration for a given response size
   */
  static getOptimalConfig(targetSize: ResponseSize): OptimizerConfig {
    switch (targetSize) {
      case ResponseSize.NANO:
        return {
          targetSize,
          strategy: CompressionStrategy.AGGRESSIVE,
          maxArrayLength: 3,
          maxStringLength: 30,
          maxDepth: 1,
        };
      
      case ResponseSize.MICRO:
        return {
          targetSize,
          strategy: CompressionStrategy.ESSENTIAL,
          maxArrayLength: 5,
          maxStringLength: 50,
          maxDepth: 2,
        };
      
      case ResponseSize.SMALL:
        return {
          targetSize,
          strategy: CompressionStrategy.MINIFY,
          maxArrayLength: 10,
          maxStringLength: 100,
          maxDepth: 3,
        };
      
      case ResponseSize.MEDIUM:
        return {
          targetSize,
          strategy: CompressionStrategy.ABBREVIATE,
          maxArrayLength: 20,
          maxStringLength: 200,
          maxDepth: 4,
        };
      
      case ResponseSize.LARGE:
        return {
          targetSize,
          strategy: CompressionStrategy.NONE,
          maxArrayLength: 50,
          maxStringLength: 500,
          maxDepth: 5,
        };
      
      default:
        return {
          targetSize: ResponseSize.SMALL,
          strategy: CompressionStrategy.MINIFY,
          maxArrayLength: 10,
          maxStringLength: 100,
          maxDepth: 3,
        };
    }
  }
}

/**
 * Create a response optimizer with preset configuration
 */
export function createOptimizer(size: ResponseSize = ResponseSize.SMALL): ResponseOptimizer {
  return new ResponseOptimizer(ResponseOptimizer.getOptimalConfig(size));
}

/**
 * Global optimizer instance
 */
export const defaultOptimizer = createOptimizer(ResponseSize.SMALL);