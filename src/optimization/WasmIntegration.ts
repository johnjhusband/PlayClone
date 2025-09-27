import { WasmPerformanceModule } from './WasmPerformanceModule';
import { Logger } from '../utils/Logger';
import { performance } from 'perf_hooks';

/**
 * Integration layer for WebAssembly performance modules
 * Provides fallback to JavaScript implementations when WASM is unavailable
 */
export class WasmIntegration {
  private logger: Logger;
  private wasmModule: WasmPerformanceModule | null = null;
  private useWasm: boolean = true;
  private initPromise: Promise<void> | null = null;
  private stats = {
    wasmCalls: 0,
    jsCalls: 0,
    totalTime: 0,
    wasmTime: 0,
    jsTime: 0
  };

  constructor(options: { enableWasm?: boolean } = {}) {
    this.logger = new Logger('WasmIntegration');
    this.useWasm = options.enableWasm !== false;
  }

  /**
   * Initialize WASM modules with automatic fallback
   */
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    if (!this.useWasm) {
      this.logger.info('WASM disabled, using JavaScript implementations');
      return;
    }

    try {
      // Check WebAssembly support
      if (typeof WebAssembly === 'undefined') {
        throw new Error('WebAssembly not supported in this environment');
      }

      // Initialize WASM module
      this.wasmModule = new WasmPerformanceModule();
      await this.wasmModule.initialize();
      
      // Run validation test
      await this.validateWasm();
      
      this.logger.info('WASM modules initialized and validated');
    } catch (error) {
      this.logger.warn('Failed to initialize WASM, falling back to JavaScript:', error);
      this.useWasm = false;
      this.wasmModule = null;
    }
  }

  /**
   * Validate WASM modules are working correctly
   */
  private async validateWasm(): Promise<void> {
    if (!this.wasmModule) return;

    try {
      // Check if the module has required exports
      const testModule = (this.wasmModule as any).wasmModules?.get('domParser');
      if (testModule) {
        const exports = testModule.exports as any;
        if (typeof exports.malloc !== 'function') {
          throw new Error('WASM module missing required malloc export');
        }
      }

      // Test basic operations
      const testHtml = '<div>Test</div>';
      const result = await this.wasmModule.extractText(testHtml);

      if (!result || typeof result !== 'string') {
        throw new Error('WASM validation failed: invalid response');
      }
    } catch (error) {
      throw new Error(`WASM validation failed: ${error}`);
    }
  }

  /**
   * Parse HTML with WASM acceleration
   */
  async parseHtml(html: string): Promise<any> {
    const startTime = performance.now();

    try {
      if (this.useWasm && this.wasmModule) {
        this.stats.wasmCalls++;
        const result = await this.wasmModule.parseDom(html);
        this.stats.wasmTime += performance.now() - startTime;
        return result;
      }
    } catch (error) {
      this.logger.debug('WASM parse failed, falling back to JS:', error);
    }

    // Fallback to JavaScript implementation
    this.stats.jsCalls++;
    const result = this.parseHtmlJs(html);
    this.stats.jsTime += performance.now() - startTime;
    return result;
  }

  /**
   * JavaScript HTML parser fallback
   */
  private parseHtmlJs(html: string): any {
    const elements: any[] = [];
    const stack: any[] = [];
    
    // Simple HTML tokenizer
    const tagRegex = /<\/?([^>\s]+)([^>]*)>/g;
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
      const [fullMatch, tagName, attributes] = match;
      const text = html.substring(lastIndex, match.index).trim();
      
      if (text) {
        elements.push({ type: 'text', content: text });
      }

      if (fullMatch.startsWith('</')) {
        // Closing tag
        if (stack.length > 0) {
          stack.pop();
        }
      } else if (fullMatch.endsWith('/>')) {
        // Self-closing tag
        elements.push({
          type: 'element',
          tag: tagName,
          attributes: this.parseAttributes(attributes),
          selfClosing: true
        });
      } else {
        // Opening tag
        const element = {
          type: 'element',
          tag: tagName,
          attributes: this.parseAttributes(attributes),
          children: []
        };
        
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(element);
        } else {
          elements.push(element);
        }
        
        stack.push(element);
      }
      
      lastIndex = tagRegex.lastIndex;
    }

    return { elements, parseTime: performance.now() };
  }

  /**
   * Parse HTML attributes
   */
  private parseAttributes(attrString: string): any {
    const attrs: any = {};
    const attrRegex = /(\w+)(?:="([^"]*)"|='([^']*)'|=([^\s>]+))?/g;
    let match;

    while ((match = attrRegex.exec(attrString)) !== null) {
      const [, name, doubleQuoted, singleQuoted, unquoted] = match;
      attrs[name] = doubleQuoted || singleQuoted || unquoted || true;
    }

    return attrs;
  }

  /**
   * Match CSS selectors with WASM acceleration
   */
  async matchSelector(selector: string, elements: any[]): Promise<any[]> {
    const startTime = performance.now();

    try {
      if (this.useWasm && this.wasmModule) {
        this.stats.wasmCalls++;
        const result = await this.wasmModule.matchSelector(selector, elements);
        this.stats.wasmTime += performance.now() - startTime;
        return result;
      }
    } catch (error) {
      this.logger.debug('WASM selector match failed, falling back to JS:', error);
    }

    // Fallback to JavaScript implementation
    this.stats.jsCalls++;
    const result = this.matchSelectorJs(selector, elements);
    this.stats.jsTime += performance.now() - startTime;
    return result;
  }

  /**
   * JavaScript CSS selector matcher fallback
   */
  private matchSelectorJs(selector: string, elements: any[]): any[] {
    const matches: any[] = [];
    
    // Simple selector parser
    const parts = selector.split(/\s+/);
    const lastPart = parts[parts.length - 1];
    
    // Parse the last selector part
    let tagName = '';
    let id = '';
    let classes: string[] = [];
    
    // Extract tag, id, and classes
    const selectorRegex = /^([a-zA-Z0-9-]*)(#[a-zA-Z0-9-]+)?(\.([a-zA-Z0-9-]+))*$/;
    const match = lastPart.match(selectorRegex);
    
    if (!match) return matches;
    
    if (match[1]) tagName = match[1];
    if (match[2]) id = match[2].substring(1);
    if (match[3]) {
      classes = match[3].split('.').filter(c => c);
    }
    
    // Match elements
    for (const element of elements) {
      let isMatch = true;
      
      if (tagName && element.tag !== tagName) isMatch = false;
      if (id && element.attributes?.id !== id) isMatch = false;
      
      if (classes.length > 0 && element.attributes?.class) {
        const elementClasses = element.attributes.class.split(/\s+/);
        for (const cls of classes) {
          if (!elementClasses.includes(cls)) {
            isMatch = false;
            break;
          }
        }
      } else if (classes.length > 0) {
        isMatch = false;
      }
      
      if (isMatch) {
        matches.push(element);
      }
    }
    
    return matches;
  }

  /**
   * Extract text with WASM acceleration
   */
  async extractText(html: string, options?: any): Promise<string> {
    const startTime = performance.now();

    try {
      if (this.useWasm && this.wasmModule) {
        this.stats.wasmCalls++;
        const result = await this.wasmModule.extractText(html, options);
        this.stats.wasmTime += performance.now() - startTime;
        return result;
      }
    } catch (error) {
      this.logger.debug('WASM text extraction failed, falling back to JS:', error);
    }

    // Fallback to JavaScript implementation
    this.stats.jsCalls++;
    const result = this.extractTextJs(html, options);
    this.stats.jsTime += performance.now() - startTime;
    return result;
  }

  /**
   * JavaScript text extractor fallback
   */
  private extractTextJs(html: string, options: any = {}): string {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Apply options
    if (options.maxLength) {
      text = text.substring(0, options.maxLength);
    }
    
    return text;
  }

  /**
   * Parse JSON with WASM acceleration
   */
  async parseJson(jsonString: string): Promise<any> {
    const startTime = performance.now();

    try {
      if (this.useWasm && this.wasmModule) {
        this.stats.wasmCalls++;
        const result = await this.wasmModule.parseJson(jsonString);
        this.stats.wasmTime += performance.now() - startTime;
        return result;
      }
    } catch (error) {
      this.logger.debug('WASM JSON parse failed, falling back to JS:', error);
    }

    // Fallback to native JSON.parse
    this.stats.jsCalls++;
    const result = JSON.parse(jsonString);
    this.stats.jsTime += performance.now() - startTime;
    return result;
  }

  /**
   * Fuzzy string matching with WASM acceleration
   */
  async fuzzyMatch(pattern: string, candidates: string[]): Promise<Array<{text: string, score: number}>> {
    const startTime = performance.now();

    try {
      if (this.useWasm && this.wasmModule) {
        this.stats.wasmCalls++;
        const result = await this.wasmModule.fuzzyMatch(pattern, candidates);
        this.stats.wasmTime += performance.now() - startTime;
        return result;
      }
    } catch (error) {
      this.logger.debug('WASM fuzzy match failed, falling back to JS:', error);
    }

    // Fallback to JavaScript implementation
    this.stats.jsCalls++;
    const result = this.fuzzyMatchJs(pattern, candidates);
    this.stats.jsTime += performance.now() - startTime;
    return result;
  }

  /**
   * JavaScript fuzzy matcher fallback
   */
  private fuzzyMatchJs(pattern: string, candidates: string[]): Array<{text: string, score: number}> {
    const results: Array<{text: string, score: number}> = [];
    const patternLower = pattern.toLowerCase();
    
    for (const candidate of candidates) {
      const candidateLower = candidate.toLowerCase();
      let score = 0;
      let patternIndex = 0;
      
      // Simple fuzzy matching algorithm
      for (let i = 0; i < candidateLower.length && patternIndex < patternLower.length; i++) {
        if (candidateLower[i] === patternLower[patternIndex]) {
          score += 1;
          
          // Bonus for consecutive matches
          if (i > 0 && candidateLower[i - 1] === patternLower[patternIndex - 1]) {
            score += 0.5;
          }
          
          // Bonus for matching at word boundaries
          if (i === 0 || candidateLower[i - 1] === ' ') {
            score += 0.5;
          }
          
          patternIndex++;
        }
      }
      
      // Only include if all pattern characters were found
      if (patternIndex === patternLower.length) {
        // Normalize score by length
        score = score / candidate.length;
        results.push({ text: candidate, score });
      }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }

  /**
   * Run performance benchmark
   */
  async benchmark(html: string): Promise<any> {
    if (!this.wasmModule) {
      return {
        error: 'WASM not available for benchmarking',
        usingFallback: true
      };
    }

    return await this.wasmModule.benchmark(html);
  }

  /**
   * Get performance statistics
   */
  getStats(): any {
    const avgWasmTime = this.stats.wasmCalls > 0 
      ? this.stats.wasmTime / this.stats.wasmCalls 
      : 0;
    const avgJsTime = this.stats.jsCalls > 0 
      ? this.stats.jsTime / this.stats.jsCalls 
      : 0;

    return {
      ...this.stats,
      avgWasmTime,
      avgJsTime,
      speedup: avgJsTime > 0 ? avgJsTime / avgWasmTime : 0,
      wasmEnabled: this.useWasm,
      wasmAvailable: this.wasmModule !== null,
      wasmPercentage: this.stats.wasmCalls + this.stats.jsCalls > 0
        ? (this.stats.wasmCalls / (this.stats.wasmCalls + this.stats.jsCalls)) * 100
        : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      wasmCalls: 0,
      jsCalls: 0,
      totalTime: 0,
      wasmTime: 0,
      jsTime: 0
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.wasmModule) {
      await this.wasmModule.cleanup();
      this.wasmModule = null;
    }
    this.resetStats();
    this.logger.info('WASM integration cleaned up');
  }
}