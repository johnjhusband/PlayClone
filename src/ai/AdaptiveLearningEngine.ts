import { Page, ElementHandle } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';

interface CorrectionData {
  timestamp: Date;
  originalAction: ActionRecord;
  userCorrection: ActionRecord;
  context: PageContext;
  effectiveness: number;
}

interface ActionRecord {
  type: string;
  selector?: string;
  value?: any;
  result: boolean;
  confidence?: number;
  elementInfo?: ElementInfo;
}

interface ElementInfo {
  tag: string;
  text?: string;
  attributes: Record<string, string>;
  position?: { x: number; y: number };
  visible: boolean;
}

interface PageContext {
  url: string;
  title: string;
  domain: string;
  pageType?: string;
  elements?: ElementInfo[];
}

interface SelectorPattern {
  pattern: string;
  successRate: number;
  usageCount: number;
  lastUsed: Date;
  contexts: string[];
}

interface ActionPattern {
  sequence: string[];
  successRate: number;
  optimizedSequence?: string[];
  contexts: Set<string>;
  averageTime: number;
}

interface LearningModel {
  corrections: CorrectionData[];
  selectorPatterns: Map<string, SelectorPattern>;
  actionPatterns: Map<string, ActionPattern>;
  contextModels: Map<string, ContextModel>;
  globalConfidence: number;
}

interface ContextModel {
  domain: string;
  pageTypes: Set<string>;
  commonElements: ElementInfo[];
  successfulSelectors: string[];
  failedSelectors: string[];
}

export class AdaptiveLearningEngine {
  private logger: Logger;
  private model: LearningModel;
  private modelPath: string;
  private learningRate: number = 0.1;
  private confidenceThreshold: number = 0.7;
  private maxCorrections: number = 1000;
  private autosaveInterval: number = 60000; // 1 minute
  private autosaveTimer?: NodeJS.Timeout;

  constructor(modelPath: string = './learning-model.json') {
    this.logger = new Logger('AdaptiveLearningEngine');
    this.modelPath = modelPath;
    this.model = this.loadModel();
    this.startAutosave();
  }

  /**
   * Record a user correction to learn from
   */
  async recordCorrection(
    originalAction: ActionRecord,
    userCorrection: ActionRecord,
    page: Page
  ): Promise<void> {
    try {
      const context = await this.extractPageContext(page);
      
      const correction: CorrectionData = {
        timestamp: new Date(),
        originalAction,
        userCorrection,
        context,
        effectiveness: this.calculateEffectiveness(originalAction, userCorrection)
      };

      // Add to corrections history
      this.model.corrections.push(correction);
      if (this.model.corrections.length > this.maxCorrections) {
        this.model.corrections.shift(); // Remove oldest
      }

      // Learn from the correction
      await this.learnFromCorrection(correction);
      
      // Update global confidence
      this.updateGlobalConfidence();

      this.logger.info('Recorded user correction', {
        original: originalAction.type,
        corrected: userCorrection.type,
        effectiveness: correction.effectiveness
      });
    } catch (error) {
      this.logger.error('Failed to record correction:', error);
    }
  }

  /**
   * Suggest improved selector based on learning
   */
  async suggestSelector(
    element: ElementInfo,
    context: PageContext
  ): Promise<{
    selector: string;
    confidence: number;
    alternatives: string[];
  }> {
    const suggestions: Array<{ selector: string; score: number }> = [];

    // Check context-specific patterns
    const contextModel = this.model.contextModels.get(context.domain);
    if (contextModel) {
      for (const selector of contextModel.successfulSelectors) {
        const score = this.calculateSelectorScore(selector, element, context);
        suggestions.push({ selector, score });
      }
    }

    // Check global selector patterns
    for (const [pattern, data] of this.model.selectorPatterns) {
      if (this.matchesElement(pattern, element)) {
        suggestions.push({
          selector: pattern,
          score: data.successRate * (data.usageCount / 100)
        });
      }
    }

    // Generate new selectors based on element attributes
    const generatedSelectors = this.generateSelectors(element);
    for (const selector of generatedSelectors) {
      suggestions.push({
        selector,
        score: this.model.globalConfidence * 0.5
      });
    }

    // Sort by score
    suggestions.sort((a, b) => b.score - a.score);

    // Return top suggestion with alternatives
    const topSuggestion = suggestions[0] || { selector: '', score: 0 };
    const alternatives = suggestions.slice(1, 4).map(s => s.selector);

    return {
      selector: topSuggestion.selector || this.fallbackSelector(element),
      confidence: Math.min(topSuggestion.score, 1),
      alternatives
    };
  }

  /**
   * Optimize action sequence based on learned patterns
   */
  async optimizeActionSequence(
    actions: ActionRecord[],
    context: PageContext
  ): Promise<ActionRecord[]> {
    const sequenceKey = actions.map(a => a.type).join('->');
    const pattern = this.model.actionPatterns.get(sequenceKey);

    if (pattern && pattern.optimizedSequence) {
      // Use optimized sequence if available
      return this.reconstructActions(pattern.optimizedSequence, actions);
    }

    // Apply learned optimizations
    const optimized: ActionRecord[] = [];
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      
      // Skip redundant actions
      if (this.isRedundant(action, optimized)) {
        continue;
      }

      // Merge compatible actions
      if (i < actions.length - 1) {
        const merged = this.tryMergeActions(action, actions[i + 1]);
        if (merged) {
          optimized.push(merged);
          i++; // Skip next action
          continue;
        }
      }

      // Apply selector improvements
      if (action.selector) {
        const improved = await this.improveSelector(action.selector, context);
        action.selector = improved.selector;
        action.confidence = improved.confidence;
      }

      optimized.push(action);
    }

    // Record the optimization for future use
    if (optimized.length < actions.length) {
      this.recordOptimization(sequenceKey, optimized, context);
    }

    return optimized;
  }

  /**
   * Get confidence score for an action
   */
  getActionConfidence(
    action: ActionRecord,
    context: PageContext
  ): number {
    let confidence = this.model.globalConfidence;

    // Adjust based on selector pattern performance
    if (action.selector) {
      const pattern = this.model.selectorPatterns.get(action.selector);
      if (pattern) {
        confidence *= pattern.successRate;
      }
    }

    // Adjust based on context
    const contextModel = this.model.contextModels.get(context.domain);
    if (contextModel) {
      if (action.selector && contextModel.failedSelectors.includes(action.selector)) {
        confidence *= 0.5;
      } else if (action.selector && contextModel.successfulSelectors.includes(action.selector)) {
        confidence *= 1.2;
      }
    }

    // Adjust based on action type patterns
    const sequencePattern = this.findMatchingPattern(action);
    if (sequencePattern) {
      confidence *= sequencePattern.successRate;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Learn from a correction
   */
  private async learnFromCorrection(correction: CorrectionData): Promise<void> {
    // Update selector patterns
    if (correction.originalAction.selector && correction.userCorrection.selector) {
      this.updateSelectorPattern(
        correction.originalAction.selector,
        false,
        correction.context
      );
      this.updateSelectorPattern(
        correction.userCorrection.selector,
        true,
        correction.context
      );
    }

    // Update context model
    this.updateContextModel(correction.context, correction);

    // Learn action patterns
    if (correction.originalAction.type !== correction.userCorrection.type) {
      this.learnActionPattern(correction);
    }
  }

  /**
   * Update selector pattern statistics
   */
  private updateSelectorPattern(
    selector: string,
    success: boolean,
    context: PageContext
  ): void {
    let pattern = this.model.selectorPatterns.get(selector);
    
    if (!pattern) {
      pattern = {
        pattern: selector,
        successRate: success ? 1 : 0,
        usageCount: 1,
        lastUsed: new Date(),
        contexts: [context.domain]
      };
    } else {
      // Update success rate with exponential moving average
      pattern.successRate = pattern.successRate * (1 - this.learningRate) +
                           (success ? 1 : 0) * this.learningRate;
      pattern.usageCount++;
      pattern.lastUsed = new Date();
      
      if (!pattern.contexts.includes(context.domain)) {
        pattern.contexts.push(context.domain);
      }
    }

    this.model.selectorPatterns.set(selector, pattern);
  }

  /**
   * Update context-specific model
   */
  private updateContextModel(
    context: PageContext,
    correction: CorrectionData
  ): void {
    let contextModel = this.model.contextModels.get(context.domain);
    
    if (!contextModel) {
      contextModel = {
        domain: context.domain,
        pageTypes: new Set([context.pageType || 'unknown']),
        commonElements: context.elements || [],
        successfulSelectors: [],
        failedSelectors: []
      };
    }

    if (context.pageType) {
      contextModel.pageTypes.add(context.pageType);
    }

    // Update selector lists
    if (correction.originalAction.selector && !correction.originalAction.result) {
      if (!contextModel.failedSelectors.includes(correction.originalAction.selector)) {
        contextModel.failedSelectors.push(correction.originalAction.selector);
      }
    }

    if (correction.userCorrection.selector && correction.userCorrection.result) {
      if (!contextModel.successfulSelectors.includes(correction.userCorrection.selector)) {
        contextModel.successfulSelectors.push(correction.userCorrection.selector);
      }
      // Remove from failed if it's there
      const failedIndex = contextModel.failedSelectors.indexOf(correction.userCorrection.selector);
      if (failedIndex > -1) {
        contextModel.failedSelectors.splice(failedIndex, 1);
      }
    }

    this.model.contextModels.set(context.domain, contextModel);
  }

  /**
   * Learn action sequence patterns
   */
  private learnActionPattern(correction: CorrectionData): void {
    // This would analyze sequences of actions to find patterns
    // For now, we'll record simple type transitions
    const transitionKey = `${correction.originalAction.type}->${correction.userCorrection.type}`;
    
    let pattern = this.model.actionPatterns.get(transitionKey);
    if (!pattern) {
      pattern = {
        sequence: [correction.originalAction.type, correction.userCorrection.type],
        successRate: 1,
        contexts: new Set([correction.context.domain]),
        averageTime: 0
      };
    } else {
      pattern.successRate = (pattern.successRate + 1) / 2; // Simple average
      pattern.contexts.add(correction.context.domain);
    }

    this.model.actionPatterns.set(transitionKey, pattern);
  }

  /**
   * Calculate effectiveness of a correction
   */
  private calculateEffectiveness(
    original: ActionRecord,
    corrected: ActionRecord
  ): number {
    let effectiveness = 0;

    // Success is most important
    if (corrected.result && !original.result) {
      effectiveness += 0.5;
    }

    // Confidence improvement
    if (corrected.confidence && original.confidence) {
      effectiveness += (corrected.confidence - original.confidence) * 0.3;
    }

    // Simplicity (shorter selectors are better)
    if (original.selector && corrected.selector) {
      const simplification = (original.selector.length - corrected.selector.length) / original.selector.length;
      effectiveness += Math.max(0, simplification * 0.2);
    }

    return Math.min(Math.max(effectiveness, 0), 1);
  }

  /**
   * Extract page context for learning
   */
  private async extractPageContext(page: Page): Promise<PageContext> {
    const url = page.url();
    const title = await page.title();
    const domain = new URL(url).hostname;

    // Extract key elements for context
    const elements: ElementInfo[] = [];
    
    try {
      const keyElements = await page.$$eval(
        'button, input, select, a, [role="button"], [role="link"]',
        (els) => els.slice(0, 50).map(el => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().substring(0, 100),
          attributes: {
            id: el.id || '',
            class: el.className || '',
            name: (el as any).name || '',
            type: (el as any).type || '',
            role: el.getAttribute('role') || '',
            'aria-label': el.getAttribute('aria-label') || ''
          },
          position: {
            x: el.getBoundingClientRect().x,
            y: el.getBoundingClientRect().y
          },
          visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
        }))
      );
      elements.push(...keyElements);
    } catch (error) {
      this.logger.warn('Failed to extract elements:', error);
    }

    // Detect page type
    const pageType = this.detectPageType(url, title, elements);

    return {
      url,
      title,
      domain,
      pageType,
      elements
    };
  }

  /**
   * Detect the type of page for context
   */
  private detectPageType(url: string, title: string, elements: ElementInfo[]): string {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();

    if (urlLower.includes('login') || urlLower.includes('signin')) return 'login';
    if (urlLower.includes('register') || urlLower.includes('signup')) return 'registration';
    if (urlLower.includes('search') || urlLower.includes('query')) return 'search';
    if (urlLower.includes('checkout') || urlLower.includes('cart')) return 'checkout';
    if (urlLower.includes('product') || urlLower.includes('item')) return 'product';
    if (urlLower.includes('article') || urlLower.includes('blog')) return 'article';
    
    // Check title
    if (titleLower.includes('login') || titleLower.includes('sign in')) return 'login';
    if (titleLower.includes('search')) return 'search';
    if (titleLower.includes('cart') || titleLower.includes('checkout')) return 'checkout';

    // Check elements
    const hasPasswordField = elements.some(el => el.attributes.type === 'password');
    const hasSearchField = elements.some(el => 
      el.attributes.type === 'search' || 
      el.attributes.name?.includes('search') ||
      el.attributes.id?.includes('search')
    );

    if (hasPasswordField) return 'login';
    if (hasSearchField) return 'search';

    return 'general';
  }

  /**
   * Calculate selector score for an element
   */
  private calculateSelectorScore(
    selector: string,
    element: ElementInfo,
    context: PageContext
  ): number {
    let score = 0.5; // Base score

    // Check if selector pattern matches element attributes
    if (element.attributes.id && selector.includes(`#${element.attributes.id}`)) {
      score += 0.3;
    }
    
    if (element.attributes.class) {
      const classes = element.attributes.class.split(' ');
      for (const cls of classes) {
        if (cls && selector.includes(`.${cls}`)) {
          score += 0.1;
        }
      }
    }

    if (element.text && selector.includes(element.text)) {
      score += 0.2;
    }

    // Boost score for patterns that worked on this domain
    const pattern = this.model.selectorPatterns.get(selector);
    if (pattern && pattern.contexts.includes(context.domain)) {
      score *= 1.5;
    }

    return Math.min(score, 1);
  }

  /**
   * Check if a pattern matches an element
   */
  private matchesElement(pattern: string, element: ElementInfo): boolean {
    // Simple matching logic - could be enhanced
    if (pattern.startsWith('#') && element.attributes.id) {
      return pattern === `#${element.attributes.id}`;
    }

    if (pattern.startsWith('.') && element.attributes.class) {
      const className = pattern.substring(1);
      return element.attributes.class.split(' ').includes(className);
    }

    if (element.text && pattern.includes('text=')) {
      const textPattern = pattern.match(/text=["']([^"']+)["']/);
      if (textPattern) {
        return element.text.includes(textPattern[1]);
      }
    }

    return false;
  }

  /**
   * Generate selector suggestions for an element
   */
  private generateSelectors(element: ElementInfo): string[] {
    const selectors: string[] = [];

    if (element.attributes.id) {
      selectors.push(`#${element.attributes.id}`);
    }

    if (element.attributes.class) {
      const classes = element.attributes.class.split(' ').filter(c => c);
      if (classes.length > 0) {
        selectors.push(`.${classes[0]}`);
        if (classes.length > 1) {
          selectors.push(`.${classes.join('.')}`);
        }
      }
    }

    if (element.text) {
      selectors.push(`text="${element.text}"`);
      selectors.push(`${element.tag}:has-text("${element.text}")`);
    }

    if (element.attributes['aria-label']) {
      selectors.push(`[aria-label="${element.attributes['aria-label']}"]`);
    }

    if (element.attributes.role) {
      selectors.push(`[role="${element.attributes.role}"]`);
    }

    if (element.attributes.name) {
      selectors.push(`[name="${element.attributes.name}"]`);
    }

    return selectors;
  }

  /**
   * Fallback selector generation
   */
  private fallbackSelector(element: ElementInfo): string {
    if (element.attributes.id) {
      return `#${element.attributes.id}`;
    }
    if (element.text) {
      return `text="${element.text}"`;
    }
    if (element.attributes.class) {
      const firstClass = element.attributes.class.split(' ')[0];
      return `.${firstClass}`;
    }
    return element.tag;
  }

  /**
   * Check if an action is redundant
   */
  private isRedundant(action: ActionRecord, previous: ActionRecord[]): boolean {
    if (previous.length === 0) return false;

    const lastAction = previous[previous.length - 1];
    
    // Same action on same element
    if (action.type === lastAction.type && 
        action.selector === lastAction.selector) {
      return true;
    }

    // Multiple clicks on same element
    if (action.type === 'click' && lastAction.type === 'click' &&
        action.selector === lastAction.selector) {
      return true;
    }

    return false;
  }

  /**
   * Try to merge two compatible actions
   */
  private tryMergeActions(
    action1: ActionRecord,
    action2: ActionRecord
  ): ActionRecord | null {
    // Merge fill followed by click on same form
    if (action1.type === 'fill' && action2.type === 'click') {
      // Check if they're in the same form context
      if (this.inSameContext(action1, action2)) {
        return {
          type: 'fill-and-submit',
          selector: action1.selector,
          value: action1.value,
          result: true,
          confidence: Math.min(action1.confidence || 1, action2.confidence || 1)
        };
      }
    }

    // Merge multiple fills into batch fill
    if (action1.type === 'fill' && action2.type === 'fill') {
      return {
        type: 'batch-fill',
        selector: 'form',
        value: {
          [action1.selector || '']: action1.value,
          [action2.selector || '']: action2.value
        },
        result: true,
        confidence: Math.min(action1.confidence || 1, action2.confidence || 1)
      };
    }

    return null;
  }

  /**
   * Check if actions are in the same context
   */
  private inSameContext(action1: ActionRecord, action2: ActionRecord): boolean {
    // Simple heuristic - could be improved
    if (!action1.selector || !action2.selector) return false;
    
    // Check if selectors share common parent
    const selector1Parts = action1.selector.split(' ');
    const selector2Parts = action2.selector.split(' ');
    
    return selector1Parts[0] === selector2Parts[0];
  }

  /**
   * Reconstruct actions from optimized sequence
   */
  private reconstructActions(
    optimizedTypes: string[],
    originalActions: ActionRecord[]
  ): ActionRecord[] {
    const reconstructed: ActionRecord[] = [];
    const actionMap = new Map<string, ActionRecord>();
    
    for (const action of originalActions) {
      actionMap.set(action.type, action);
    }

    for (const type of optimizedTypes) {
      const action = actionMap.get(type);
      if (action) {
        reconstructed.push(action);
      }
    }

    return reconstructed;
  }

  /**
   * Improve a selector based on learning
   */
  private async improveSelector(
    selector: string,
    context: PageContext
  ): Promise<{ selector: string; confidence: number }> {
    const pattern = this.model.selectorPatterns.get(selector);
    
    if (!pattern || pattern.successRate < this.confidenceThreshold) {
      // Try to find a better selector
      for (const [altSelector, altPattern] of this.model.selectorPatterns) {
        if (altPattern.successRate > (pattern?.successRate || 0) &&
            altPattern.contexts.includes(context.domain)) {
          return {
            selector: altSelector,
            confidence: altPattern.successRate
          };
        }
      }
    }

    return {
      selector,
      confidence: pattern?.successRate || this.model.globalConfidence
    };
  }

  /**
   * Record an optimization for future use
   */
  private recordOptimization(
    sequenceKey: string,
    optimized: ActionRecord[],
    context: PageContext
  ): void {
    let pattern = this.model.actionPatterns.get(sequenceKey);
    
    if (!pattern) {
      pattern = {
        sequence: sequenceKey.split('->'),
        successRate: 1,
        contexts: new Set([context.domain]),
        averageTime: 0
      };
    }

    pattern.optimizedSequence = optimized.map(a => a.type);
    this.model.actionPatterns.set(sequenceKey, pattern);
  }

  /**
   * Find matching action pattern
   */
  private findMatchingPattern(action: ActionRecord): ActionPattern | null {
    for (const [key, pattern] of this.model.actionPatterns) {
      if (pattern.sequence.includes(action.type)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Update global confidence based on recent performance
   */
  private updateGlobalConfidence(): void {
    if (this.model.corrections.length === 0) return;

    // Calculate recent success rate
    const recentCorrections = this.model.corrections.slice(-20);
    const averageEffectiveness = recentCorrections.reduce(
      (sum, c) => sum + c.effectiveness, 0
    ) / recentCorrections.length;

    // Update global confidence with exponential moving average
    this.model.globalConfidence = this.model.globalConfidence * (1 - this.learningRate) +
                                  averageEffectiveness * this.learningRate;
  }

  /**
   * Load model from disk
   */
  private loadModel(): LearningModel {
    try {
      if (fs.existsSync(this.modelPath)) {
        const data = fs.readFileSync(this.modelPath, 'utf8');
        const loaded = JSON.parse(data);
        
        // Reconstruct Maps and Sets
        return {
          corrections: loaded.corrections || [],
          selectorPatterns: new Map(loaded.selectorPatterns || []),
          actionPatterns: new Map(loaded.actionPatterns?.map((item: any) => [
            item[0],
            { ...item[1], contexts: new Set(item[1].contexts) }
          ]) || []),
          contextModels: new Map(loaded.contextModels?.map((item: any) => [
            item[0],
            { ...item[1], pageTypes: new Set(item[1].pageTypes) }
          ]) || []),
          globalConfidence: loaded.globalConfidence || 0.7
        };
      }
    } catch (error) {
      this.logger.warn('Failed to load model:', error);
    }

    // Return default model
    return {
      corrections: [],
      selectorPatterns: new Map(),
      actionPatterns: new Map(),
      contextModels: new Map(),
      globalConfidence: 0.7
    };
  }

  /**
   * Save model to disk
   */
  saveModel(): void {
    try {
      const toSave = {
        corrections: this.model.corrections,
        selectorPatterns: Array.from(this.model.selectorPatterns.entries()),
        actionPatterns: Array.from(this.model.actionPatterns.entries()).map(([key, value]) => [
          key,
          { ...value, contexts: Array.from(value.contexts) }
        ]),
        contextModels: Array.from(this.model.contextModels.entries()).map(([key, value]) => [
          key,
          { ...value, pageTypes: Array.from(value.pageTypes) }
        ]),
        globalConfidence: this.model.globalConfidence
      };

      fs.writeFileSync(this.modelPath, JSON.stringify(toSave, null, 2));
      this.logger.info('Model saved successfully');
    } catch (error) {
      this.logger.error('Failed to save model:', error);
    }
  }

  /**
   * Start autosave timer
   */
  private startAutosave(): void {
    this.autosaveTimer = setInterval(() => {
      this.saveModel();
    }, this.autosaveInterval);
  }

  /**
   * Clean up and save on destroy
   */
  destroy(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
    }
    this.saveModel();
  }

  /**
   * Export learning statistics
   */
  getStatistics(): {
    totalCorrections: number;
    uniqueSelectors: number;
    uniquePatterns: number;
    domainsLearned: number;
    globalConfidence: number;
    topSelectors: Array<{ selector: string; successRate: number }>;
    topPatterns: Array<{ pattern: string; successRate: number }>;
  } {
    const topSelectors = Array.from(this.model.selectorPatterns.entries())
      .sort((a, b) => b[1].successRate - a[1].successRate)
      .slice(0, 10)
      .map(([selector, data]) => ({
        selector,
        successRate: data.successRate
      }));

    const topPatterns = Array.from(this.model.actionPatterns.entries())
      .sort((a, b) => b[1].successRate - a[1].successRate)
      .slice(0, 10)
      .map(([pattern, data]) => ({
        pattern,
        successRate: data.successRate
      }));

    return {
      totalCorrections: this.model.corrections.length,
      uniqueSelectors: this.model.selectorPatterns.size,
      uniquePatterns: this.model.actionPatterns.size,
      domainsLearned: this.model.contextModels.size,
      globalConfidence: this.model.globalConfidence,
      topSelectors,
      topPatterns
    };
  }

  /**
   * Reset learning model
   */
  reset(): void {
    this.model = {
      corrections: [],
      selectorPatterns: new Map(),
      actionPatterns: new Map(),
      contextModels: new Map(),
      globalConfidence: 0.7
    };
    this.saveModel();
    this.logger.info('Learning model reset');
  }
}