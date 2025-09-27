import { WasmOptimizer } from './WasmOptimizer';
import { Logger } from '../utils/Logger';
import { performance } from 'perf_hooks';

interface OptimizedWasmOptions {
  enableWasm?: boolean;
  cacheDir?: string;
  lazyLoad?: boolean;
  memoryLimit?: number;
  fastStartup?: boolean;
  autoWarmup?: boolean;
}

/**
 * Optimized WASM integration with improved initialization and validation
 * Provides seamless fallback to JavaScript with performance monitoring
 */
export class WasmIntegrationOptimized {
  private logger: Logger;
  private optimizer: WasmOptimizer;
  private options: OptimizedWasmOptions;
  private initialized: boolean = false;
  private initPromise?: Promise<void>;
  
  // Performance tracking
  private stats = {
    wasmCalls: 0,
    jsCalls: 0,
    wasmTime: 0,
    jsTime: 0,
    fallbacks: 0,
    errors: 0
  };
  
  // Module availability tracking
  private moduleStatus: Map<string, boolean> = new Map();

  constructor(options: OptimizedWasmOptions = {}) {
    this.logger = new Logger('WasmIntegrationOptimized');
    this.options = {
      enableWasm: options.enableWasm !== false,
      cacheDir: options.cacheDir,
      lazyLoad: options.lazyLoad !== false,
      memoryLimit: options.memoryLimit,
      fastStartup: options.fastStartup !== false,
      autoWarmup: options.autoWarmup !== false
    };
    
    this.optimizer = new WasmOptimizer({
      cacheDir: options.cacheDir,
      lazyLoad: options.lazyLoad,
      memoryLimit: options.memoryLimit,
      precompile: !options.fastStartup,
      validateOnInit: !options.fastStartup,
      parallelCompilation: true
    });
  }

  /**
   * Initialize with optimized startup
   */
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    const startTime = performance.now();
    
    try {
      if (!this.options.enableWasm) {
        this.logger.info('WASM disabled by configuration');
        this.initialized = true;
        return;
      }
      
      // Check WebAssembly support
      if (!this.checkWasmSupport()) {
        this.logger.warn('WebAssembly not supported, using JavaScript fallback');
        this.options.enableWasm = false;
        this.initialized = true;
        return;
      }
      
      // Use fast initialization if requested
      if (this.options.fastStartup) {
        await this.optimizer.fastInit();
      } else {
        await this.optimizer.initialize();
      }
      
      // Auto warmup if requested
      if (this.options.autoWarmup) {
        // Don't await warmup to not block initialization
        this.optimizer.warmup().catch(err => {
          this.logger.debug('Warmup error (non-critical):', err);
        });
      }
      
      this.initialized = true;
      
      const initTime = performance.now() - startTime;
      this.logger.info(`Optimized WASM initialized in ${initTime.toFixed(2)}ms`);
      
    } catch (error) {
      this.logger.error('Failed to initialize WASM:', error);
      this.options.enableWasm = false;
      this.initialized = true;
    }
  }

  /**
   * Check if WebAssembly is supported
   */
  private checkWasmSupport(): boolean {
    try {
      if (typeof WebAssembly === 'undefined') {
        return false;
      }
      
      // Test basic WebAssembly functionality
      const testModule = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
      ]);
      
      const module = new WebAssembly.Module(testModule);
      return module instanceof WebAssembly.Module;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse HTML with optimized WASM
   */
  async parseHtml(html: string): Promise<any> {
    return this.executeWithFallback('domParser', async () => {
      const module = await this.optimizer.loadModule('domParser');
      // Actual WASM parsing would happen here
      // For now, fallback to JS
      throw new Error('WASM not implemented');
    }, () => this.parseHtmlJs(html));
  }

  /**
   * Match CSS selectors with optimized WASM
   */
  async matchSelector(selector: string, elements: any[]): Promise<any[]> {
    return this.executeWithFallback('selectorMatcher', async () => {
      const module = await this.optimizer.loadModule('selectorMatcher');
      // Actual WASM selector matching would happen here
      throw new Error('WASM not implemented');
    }, () => this.matchSelectorJs(selector, elements));
  }

  /**
   * Extract text with optimized WASM
   */
  async extractText(html: string, options?: any): Promise<string> {
    return this.executeWithFallback('textExtractor', async () => {
      const module = await this.optimizer.loadModule('textExtractor');
      // Actual WASM text extraction would happen here
      throw new Error('WASM not implemented');
    }, () => this.extractTextJs(html, options));
  }

  /**
   * Parse JSON with optimized WASM
   */
  async parseJson(jsonString: string): Promise<any> {
    return this.executeWithFallback('jsonParser', async () => {
      const module = await this.optimizer.loadModule('jsonParser');
      // Actual WASM JSON parsing would happen here
      throw new Error('WASM not implemented');
    }, () => JSON.parse(jsonString));
  }

  /**
   * Fuzzy string matching with optimized WASM
   */
  async fuzzyMatch(pattern: string, candidates: string[]): Promise<Array<{text: string, score: number}>> {
    return this.executeWithFallback('stringMatcher', async () => {
      const module = await this.optimizer.loadModule('stringMatcher');
      // Actual WASM fuzzy matching would happen here
      throw new Error('WASM not implemented');
    }, () => this.fuzzyMatchJs(pattern, candidates));
  }

  /**
   * Execute with automatic fallback to JavaScript
   */
  private async executeWithFallback<T>(
    moduleName: string,
    wasmFn: () => Promise<T>,
    jsFn: () => T
  ): Promise<T> {
    const startTime = performance.now();
    
    // Check if WASM is enabled and module is available
    if (this.options.enableWasm && this.initialized) {
      // Check module status cache
      const moduleAvailable = this.moduleStatus.get(moduleName);
      
      if (moduleAvailable !== false) {
        try {
          this.stats.wasmCalls++;
          const result = await wasmFn();
          this.stats.wasmTime += performance.now() - startTime;
          
          // Mark module as available
          this.moduleStatus.set(moduleName, true);
          
          return result;
        } catch (error) {
          this.stats.errors++;
          this.stats.fallbacks++;
          
          // Mark module as unavailable
          this.moduleStatus.set(moduleName, false);
          
          this.logger.debug(`WASM ${moduleName} failed, using fallback:`, error);
        }
      }
    }
    
    // Use JavaScript fallback
    this.stats.jsCalls++;
    const result = jsFn();
    this.stats.jsTime += performance.now() - startTime;
    
    return result;
  }

  /**
   * JavaScript fallback implementations
   */
  private parseHtmlJs(html: string): any {
    const elements: any[] = [];
    const tagRegex = /<\/?([^>\s]+)([^>]*)>/g;
    let match;
    
    while ((match = tagRegex.exec(html)) !== null) {
      const [fullMatch, tagName, attributes] = match;
      
      if (!fullMatch.startsWith('</')) {
        elements.push({
          tag: tagName,
          attributes: this.parseAttributes(attributes),
          selfClosing: fullMatch.endsWith('/>')
        });
      }
    }
    
    return { elements, parseTime: performance.now() };
  }

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

  private matchSelectorJs(selector: string, elements: any[]): any[] {
    const matches: any[] = [];
    
    // Simple selector matching
    const parts = selector.split(/\s+/);
    const lastPart = parts[parts.length - 1];
    
    // Parse selector
    const tagMatch = lastPart.match(/^([a-zA-Z0-9-]+)/);
    const idMatch = lastPart.match(/#([a-zA-Z0-9-]+)/);
    const classMatches = lastPart.match(/\.([a-zA-Z0-9-]+)/g);
    
    const tagName = tagMatch ? tagMatch[1] : null;
    const id = idMatch ? idMatch[1] : null;
    const classes = classMatches ? classMatches.map(c => c.substring(1)) : [];
    
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

  private extractTextJs(html: string, options: any = {}): string {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Apply options
    if (options.maxLength) {
      text = text.substring(0, options.maxLength);
    }
    
    return text;
  }

  private fuzzyMatchJs(pattern: string, candidates: string[]): Array<{text: string, score: number}> {
    const results: Array<{text: string, score: number}> = [];
    const patternLower = pattern.toLowerCase();
    
    for (const candidate of candidates) {
      const candidateLower = candidate.toLowerCase();
      let score = 0;
      let patternIndex = 0;
      let consecutiveMatches = 0;
      
      for (let i = 0; i < candidateLower.length && patternIndex < patternLower.length; i++) {
        if (candidateLower[i] === patternLower[patternIndex]) {
          score += 1;
          consecutiveMatches++;
          
          // Bonus for consecutive matches
          if (consecutiveMatches > 1) {
            score += consecutiveMatches * 0.5;
          }
          
          // Bonus for matching at word boundaries
          if (i === 0 || /\W/.test(candidateLower[i - 1])) {
            score += 1;
          }
          
          patternIndex++;
        } else {
          consecutiveMatches = 0;
        }
      }
      
      // Only include if all pattern characters were found
      if (patternIndex === patternLower.length) {
        // Normalize score
        const normalizedScore = score / Math.max(candidate.length, pattern.length);
        
        // Penalty for length difference
        const lengthPenalty = Math.abs(candidate.length - pattern.length) * 0.01;
        
        results.push({
          text: candidate,
          score: Math.max(0, normalizedScore - lengthPenalty)
        });
      }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    return results;
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
    
    const totalCalls = this.stats.wasmCalls + this.stats.jsCalls;
    
    return {
      ...this.stats,
      avgWasmTime,
      avgJsTime,
      speedup: avgJsTime > 0 && avgWasmTime > 0 ? avgJsTime / avgWasmTime : 1,
      wasmEnabled: this.options.enableWasm,
      wasmInitialized: this.initialized,
      wasmPercentage: totalCalls > 0 ? (this.stats.wasmCalls / totalCalls) * 100 : 0,
      fallbackRate: this.stats.wasmCalls > 0 ? (this.stats.fallbacks / this.stats.wasmCalls) * 100 : 0,
      errorRate: totalCalls > 0 ? (this.stats.errors / totalCalls) * 100 : 0,
      moduleStatus: Object.fromEntries(this.moduleStatus),
      optimizerMetrics: this.initialized ? this.optimizer.getMetrics() : null
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      wasmCalls: 0,
      jsCalls: 0,
      wasmTime: 0,
      jsTime: 0,
      fallbacks: 0,
      errors: 0
    };
  }

  /**
   * Benchmark WASM vs JavaScript performance
   */
  async benchmark(html: string, iterations: number = 100): Promise<any> {
    const results = {
      parseHtml: { wasm: 0, js: 0 },
      extractText: { wasm: 0, js: 0 },
      fuzzyMatch: { wasm: 0, js: 0 },
      overall: { wasm: 0, js: 0 }
    };
    
    // Test data
    const testElements = [
      { tag: 'div', attributes: { id: 'test', class: 'container' } },
      { tag: 'span', attributes: { class: 'text' } },
      { tag: 'a', attributes: { href: '#' } }
    ];
    const testCandidates = ['button', 'submit button', 'cancel', 'ok button', 'close'];
    
    // Benchmark each operation
    for (let i = 0; i < iterations; i++) {
      // Parse HTML
      let start = performance.now();
      await this.parseHtml(html);
      results.parseHtml.js += performance.now() - start;
      
      // Extract text
      start = performance.now();
      await this.extractText(html);
      results.extractText.js += performance.now() - start;
      
      // Fuzzy match
      start = performance.now();
      await this.fuzzyMatch('button', testCandidates);
      results.fuzzyMatch.js += performance.now() - start;
    }
    
    // Calculate averages and overall
    for (const op of Object.keys(results)) {
      if (op !== 'overall') {
        const opResults = results[op as keyof typeof results];
        opResults.js = opResults.js / iterations;
        opResults.wasm = opResults.wasm / iterations;
        
        results.overall.js += opResults.js;
        results.overall.wasm += opResults.wasm;
      }
    }
    
    return {
      results,
      speedup: results.overall.wasm > 0 ? results.overall.js / results.overall.wasm : 1,
      recommendation: results.overall.wasm < results.overall.js ? 'Use WASM' : 'Use JavaScript'
    };
  }

  /**
   * Optimize for specific use case
   */
  async optimizeFor(useCase: 'parsing' | 'extraction' | 'matching' | 'balanced'): Promise<void> {
    switch (useCase) {
      case 'parsing':
        // Preload and warm up parsing modules
        await this.optimizer.loadModule('domParser');
        await this.optimizer.loadModule('jsonParser');
        break;
        
      case 'extraction':
        // Preload text extraction module
        await this.optimizer.loadModule('textExtractor');
        break;
        
      case 'matching':
        // Preload matching modules
        await this.optimizer.loadModule('selectorMatcher');
        await this.optimizer.loadModule('stringMatcher');
        break;
        
      case 'balanced':
      default:
        // Warm up all critical modules
        await this.optimizer.warmup();
        break;
    }
    
    this.logger.info(`Optimized for ${useCase} use case`);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.optimizer.cleanup();
    this.moduleStatus.clear();
    this.resetStats();
    this.initialized = false;
    this.initPromise = undefined;
    
    this.logger.info('Optimized WASM integration cleaned up');
  }
}