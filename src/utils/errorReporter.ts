/**
 * AI-optimized error reporting for PlayClone
 * Provides detailed, actionable error information for AI assistants
 */

import { PlayCloneError, normalizeError } from './errors';

/**
 * Error report structure optimized for AI consumption
 */
export interface AIErrorReport {
  /** Error summary in one sentence */
  summary: string;
  
  /** Error category for quick classification */
  category: 'browser' | 'navigation' | 'element' | 'action' | 'timeout' | 'state' | 'network' | 'unknown';
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Is the error retryable */
  retryable: boolean;
  
  /** Specific error details */
  details: {
    /** Error code for programmatic handling */
    code: string;
    
    /** Original error message */
    message: string;
    
    /** Context information */
    context?: {
      action?: string;
      selector?: string;
      url?: string;
      timeout?: number;
      attempts?: number;
    };
    
    /** Stack trace (first 3 lines only) */
    stack?: string[];
  };
  
  /** Suggested actions for the AI */
  suggestions: string[];
  
  /** Alternative approaches to try */
  alternatives: Array<{
    approach: string;
    confidence: number; // 0-1
    example?: string;
  }>;
  
  /** Related documentation or examples */
  references?: Array<{
    type: 'example' | 'doc' | 'similar_issue';
    description: string;
    solution?: string;
  }>;
  
  /** Diagnostic information */
  diagnostics?: {
    /** Browser state at time of error */
    browserState?: 'connected' | 'disconnected' | 'crashed' | 'unknown';
    
    /** Page state */
    pageState?: 'loading' | 'loaded' | 'error' | 'closed';
    
    /** Network conditions */
    network?: 'online' | 'offline' | 'slow' | 'unknown';
    
    /** Resource usage */
    resources?: {
      memoryUsage?: number;
      cpuUsage?: number;
      openPages?: number;
    };
  };
  
  /** Structured data for AI parsing */
  structured: {
    errorType: string;
    affectedComponent: string;
    userImpact: string;
    requiredAction: string;
    estimatedFixTime?: 'immediate' | 'quick' | 'moderate' | 'complex';
  };
}

/**
 * Error reporter for AI assistants
 */
export class AIErrorReporter {
  private errorHistory: AIErrorReport[] = [];
  private readonly maxHistorySize = 10;
  
  /**
   * Generate AI-optimized error report
   */
  generateReport(error: any, context?: any): AIErrorReport {
    // Normalize error to PlayCloneError
    const normalizedError = normalizeError(error, context);
    
    // Determine category
    const category = this.categorizeError(normalizedError);
    
    // Determine severity
    const severity = this.assessSeverity(normalizedError);
    
    // Generate suggestions
    const suggestions = this.generateSuggestions(normalizedError, category);
    
    // Generate alternatives
    const alternatives = this.generateAlternatives(normalizedError, category);
    
    // Generate references
    const references = this.generateReferences(normalizedError, category);
    
    // Get diagnostics
    const diagnostics = this.collectDiagnostics(context);
    
    // Create structured data
    const structured = this.createStructuredData(normalizedError, category, severity);
    
    // Build report
    const report: AIErrorReport = {
      summary: this.generateSummary(normalizedError, category),
      category,
      severity,
      retryable: normalizedError.retryable,
      details: {
        code: normalizedError.code,
        message: normalizedError.message,
        context: {
          action: normalizedError.action,
          selector: normalizedError.selector,
          url: normalizedError.url,
          timeout: normalizedError.details?.timeout,
          attempts: normalizedError.details?.attempts,
        },
        stack: this.extractStackLines(normalizedError.stack),
      },
      suggestions,
      alternatives,
      references,
      diagnostics,
      structured,
    };
    
    // Add to history
    this.addToHistory(report);
    
    return report;
  }
  
  /**
   * Categorize error
   */
  private categorizeError(error: PlayCloneError): AIErrorReport['category'] {
    const code = error.code.toLowerCase();
    
    if (code.includes('browser')) return 'browser';
    if (code.includes('navigation') || code.includes('network')) return 'navigation';
    if (code.includes('element')) return 'element';
    if (code.includes('action') || code.includes('click') || code.includes('fill')) return 'action';
    if (code.includes('timeout') || code.includes('wait')) return 'timeout';
    if (code.includes('state') || code.includes('session')) return 'state';
    if (code.includes('network') || code.includes('ssl')) return 'network';
    
    return 'unknown';
  }
  
  /**
   * Assess error severity
   */
  private assessSeverity(error: PlayCloneError): AIErrorReport['severity'] {
    // Critical: Browser crashes, unrecoverable errors
    if (error.code.includes('CRASH') || error.code.includes('FATAL')) {
      return 'critical';
    }
    
    // High: Operation completely failed, no workaround
    if (!error.retryable && !error.suggestion) {
      return 'high';
    }
    
    // Medium: Operation failed but retryable or has workaround
    if (error.retryable || error.suggestion) {
      return 'medium';
    }
    
    // Low: Minor issues, warnings
    return 'low';
  }
  
  /**
   * Generate error summary
   */
  private generateSummary(error: PlayCloneError, category: string): string {
    const action = error.action ? `${error.action} action` : 'Operation';
    const target = error.selector ? ` on "${error.selector}"` : error.url ? ` at ${error.url}` : '';
    
    switch (category) {
      case 'browser':
        return `Browser ${error.code.includes('CRASH') ? 'crashed' : 'error occurred'}${target}`;
      case 'navigation':
        return `Navigation failed${target}`;
      case 'element':
        return `Element ${error.code.includes('NOT_FOUND') ? 'not found' : 'error'}${target}`;
      case 'action':
        return `${action} failed${target}`;
      case 'timeout':
        return `Operation timed out${target}`;
      case 'state':
        return `State management error${target}`;
      case 'network':
        return `Network error occurred${target}`;
      default:
        return `${action} failed: ${error.message}`;
    }
  }
  
  /**
   * Generate suggestions based on error type
   */
  private generateSuggestions(error: PlayCloneError, category: string): string[] {
    const suggestions: string[] = [];
    
    // Add error-specific suggestion
    if (error.suggestion) {
      suggestions.push(error.suggestion);
    }
    
    // Add category-specific suggestions
    switch (category) {
      case 'element':
        suggestions.push(
          'Try using a different selector strategy (text, aria-label, css)',
          'Verify the element exists on the page',
          'Check if the page has finished loading',
          'Consider adding a wait before the action'
        );
        break;
        
      case 'timeout':
        suggestions.push(
          'Increase the timeout value',
          'Check if the page is responding slowly',
          'Verify network connectivity',
          'Consider breaking the operation into smaller steps'
        );
        break;
        
      case 'browser':
        suggestions.push(
          'Restart the browser',
          'Check system resources (memory, CPU)',
          'Verify browser binaries are installed correctly',
          'Consider using headless mode for stability'
        );
        break;
        
      case 'action':
        suggestions.push(
          'Ensure the element is interactable (visible, enabled)',
          'Check if element is covered by another element',
          'Try scrolling the element into view first',
          'Verify the action is appropriate for the element type'
        );
        break;
        
      case 'navigation':
        suggestions.push(
          'Verify the URL is correct and accessible',
          'Check network connectivity',
          'Try with a longer timeout',
          'Consider handling redirects or authentication'
        );
        break;
    }
    
    // Add retry suggestion if applicable
    if (error.retryable) {
      suggestions.push('This error is retryable - consider implementing retry logic');
    }
    
    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }
  
  /**
   * Generate alternative approaches
   */
  private generateAlternatives(error: PlayCloneError, category: string): AIErrorReport['alternatives'] {
    const alternatives: AIErrorReport['alternatives'] = [];
    
    switch (category) {
      case 'element':
        if (error.selector) {
          alternatives.push(
            {
              approach: 'Use text-based selector',
              confidence: 0.8,
              example: `await pc.click("Button Text")`
            },
            {
              approach: 'Use accessibility attributes',
              confidence: 0.7,
              example: `await pc.click("[aria-label='Submit']")`
            },
            {
              approach: 'Wait for element before action',
              confidence: 0.6,
              example: `await pc.waitForElement("${error.selector}"); await pc.click("${error.selector}")`
            }
          );
        }
        break;
        
      case 'timeout':
        alternatives.push(
          {
            approach: 'Increase timeout and retry',
            confidence: 0.7,
            example: `await pc.click(selector, { timeout: 60000 })`
          },
          {
            approach: 'Break into smaller operations',
            confidence: 0.6
          },
          {
            approach: 'Use page.reload() and retry',
            confidence: 0.5
          }
        );
        break;
        
      case 'action':
        alternatives.push(
          {
            approach: 'Use JavaScript execution',
            confidence: 0.6,
            example: `await pc.evaluate(() => document.querySelector('${error.selector}')?.click())`
          },
          {
            approach: 'Try force click',
            confidence: 0.5,
            example: `await pc.click(selector, { force: true })`
          }
        );
        break;
    }
    
    return alternatives;
  }
  
  /**
   * Generate references
   */
  private generateReferences(error: PlayCloneError, category: string): AIErrorReport['references'] {
    const references: AIErrorReport['references'] = [];
    
    // Add common references based on category
    switch (category) {
      case 'element':
        references.push({
          type: 'doc',
          description: 'Element selection strategies',
          solution: 'Use specific selectors: #id, .class, text=, aria-label='
        });
        break;
        
      case 'timeout':
        references.push({
          type: 'doc',
          description: 'Timeout configuration',
          solution: 'Adjust timeout in options: { timeout: 30000 }'
        });
        break;
        
      case 'browser':
        references.push({
          type: 'doc',
          description: 'Browser lifecycle management',
          solution: 'Use BrowserManager for proper lifecycle control'
        });
        break;
    }
    
    // Add similar issue if found in history
    const similarIssue = this.findSimilarIssue(error);
    if (similarIssue) {
      references.push({
        type: 'similar_issue',
        description: `Similar error occurred previously: ${similarIssue.summary}`,
        solution: similarIssue.suggestions[0]
      });
    }
    
    return references;
  }
  
  /**
   * Collect diagnostic information
   */
  private collectDiagnostics(context?: any): AIErrorReport['diagnostics'] {
    return {
      browserState: context?.browserState || 'unknown',
      pageState: context?.pageState || 'unknown',
      network: context?.network || 'unknown',
      resources: context?.resources
    };
  }
  
  /**
   * Create structured data for AI parsing
   */
  private createStructuredData(
    error: PlayCloneError,
    category: string,
    severity: string
  ): AIErrorReport['structured'] {
    return {
      errorType: error.code,
      affectedComponent: category,
      userImpact: this.assessUserImpact(severity),
      requiredAction: this.determineRequiredAction(error),
      estimatedFixTime: this.estimateFixTime(error, category)
    };
  }
  
  /**
   * Assess user impact
   */
  private assessUserImpact(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'Complete failure - operation cannot proceed';
      case 'high':
        return 'Major disruption - primary functionality affected';
      case 'medium':
        return 'Moderate impact - workaround available';
      case 'low':
        return 'Minor issue - minimal impact';
      default:
        return 'Unknown impact';
    }
  }
  
  /**
   * Determine required action
   */
  private determineRequiredAction(error: PlayCloneError): string {
    if (error.retryable) {
      return 'Retry with adjusted parameters';
    }
    if (error.code.includes('CRASH')) {
      return 'Restart browser and restore state';
    }
    if (error.code.includes('NOT_FOUND')) {
      return 'Verify element selector or wait for page load';
    }
    if (error.code.includes('TIMEOUT')) {
      return 'Increase timeout or optimize operation';
    }
    return 'Review error details and apply suggested fix';
  }
  
  /**
   * Estimate fix time
   */
  private estimateFixTime(
    error: PlayCloneError,
    category: string
  ): AIErrorReport['structured']['estimatedFixTime'] {
    if (error.retryable) return 'immediate';
    if (category === 'element' || category === 'action') return 'quick';
    if (category === 'timeout' || category === 'navigation') return 'moderate';
    if (category === 'browser' || category === 'state') return 'complex';
    return 'moderate';
  }
  
  /**
   * Extract stack trace lines
   */
  private extractStackLines(stack?: string): string[] {
    if (!stack) return [];
    
    const lines = stack.split('\n').slice(0, 3);
    return lines.map(line => line.trim());
  }
  
  /**
   * Find similar issue in history
   */
  private findSimilarIssue(error: PlayCloneError): AIErrorReport | null {
    for (const report of this.errorHistory) {
      if (report.details.code === error.code) {
        return report;
      }
    }
    return null;
  }
  
  /**
   * Add report to history
   */
  private addToHistory(report: AIErrorReport): void {
    this.errorHistory.unshift(report);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.pop();
    }
  }
  
  /**
   * Get error history
   */
  getHistory(): AIErrorReport[] {
    return [...this.errorHistory];
  }
  
  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }
  
  /**
   * Generate concise error message for AI
   */
  static formatForAI(error: any, maxLength: number = 500): string {
    const reporter = new AIErrorReporter();
    const report = reporter.generateReport(error);
    
    // Create concise JSON for AI
    const concise = {
      error: report.summary,
      fix: report.suggestions[0] || 'Check error details',
      retry: report.retryable,
      alt: report.alternatives[0]?.approach
    };
    
    const json = JSON.stringify(concise);
    if (json.length <= maxLength) {
      return json;
    }
    
    // If too long, return just essentials
    return JSON.stringify({
      error: report.summary,
      fix: report.suggestions[0] || 'Check details'
    });
  }
}

/**
 * Error pattern matcher for common issues
 */
export class ErrorPatternMatcher {
  private patterns: Map<string, {
    pattern: RegExp;
    category: string;
    solution: string;
    confidence: number;
  }> = new Map([
    ['stale_element', {
      pattern: /stale element|element is not attached/i,
      category: 'element',
      solution: 'Re-locate the element after page changes',
      confidence: 0.9
    }],
    ['element_not_visible', {
      pattern: /not visible|hidden|display:\s*none/i,
      category: 'element',
      solution: 'Wait for element visibility or scroll into view',
      confidence: 0.85
    }],
    ['click_intercepted', {
      pattern: /click.*intercepted|other element would receive/i,
      category: 'action',
      solution: 'Element is covered - wait or use force click',
      confidence: 0.9
    }],
    ['network_timeout', {
      pattern: /net::|ERR_|TIMED?OUT/i,
      category: 'network',
      solution: 'Check network connectivity and retry',
      confidence: 0.8
    }],
    ['memory_issue', {
      pattern: /out of memory|heap|memory leak/i,
      category: 'browser',
      solution: 'Restart browser to free memory',
      confidence: 0.95
    }]
  ]);
  
  /**
   * Match error against patterns
   */
  match(error: any): {
    matched: boolean;
    pattern?: string;
    category?: string;
    solution?: string;
    confidence?: number;
  } {
    const message = error?.message || error?.toString() || '';
    
    for (const [name, info] of this.patterns) {
      if (info.pattern.test(message)) {
        return {
          matched: true,
          pattern: name,
          category: info.category,
          solution: info.solution,
          confidence: info.confidence
        };
      }
    }
    
    return { matched: false };
  }
  
  /**
   * Add custom pattern
   */
  addPattern(
    name: string,
    pattern: RegExp,
    category: string,
    solution: string,
    confidence: number = 0.7
  ): void {
    this.patterns.set(name, { pattern, category, solution, confidence });
  }
}