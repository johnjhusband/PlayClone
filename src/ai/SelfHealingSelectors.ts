import { Page, ElementHandle } from 'playwright-core';

interface SelectorAttributes {
  id?: string;
  class?: string[];
  tag: string;
  text?: string;
  role?: string;
  ariaLabel?: string;
  type?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  href?: string;
  src?: string;
  alt?: string;
  title?: string;
  dataTestId?: string;
  position?: {
    index: number;
    parentTag?: string;
    siblingCount?: number;
  };
  ancestors?: string[];
  nearbyText?: string[];
}

interface HealingStrategy {
  name: string;
  priority: number;
  generateSelector: (attrs: SelectorAttributes) => string | null;
  confidence: number;
}

interface SelectorHistory {
  selector: string;
  attributes: SelectorAttributes;
  lastWorked: Date;
  successCount: number;
  failureCount: number;
  confidence: number;
}

interface HealingResult {
  success: boolean;
  selector: string | null;
  strategy: string | null;
  confidence: number;
  attempts: number;
  alternatives: string[];
  healingTime: number;
}

export class SelfHealingSelectors {
  private selectorHistory: Map<string, SelectorHistory[]> = new Map();
  private healingStrategies: HealingStrategy[] = [];
  private maxHistorySize = 100;
  private minConfidenceThreshold = 0.6;
  private maxHealingAttempts = 10;
  private learningMode = true;

  constructor() {
    this.initializeHealingStrategies();
  }

  private initializeHealingStrategies(): void {
    this.healingStrategies = [
      {
        name: 'exact-id',
        priority: 10,
        confidence: 1.0,
        generateSelector: (attrs) => attrs.id ? `#${attrs.id}` : null
      },
      {
        name: 'data-testid',
        priority: 9,
        confidence: 0.95,
        generateSelector: (attrs) => 
          attrs.dataTestId ? `[data-testid="${attrs.dataTestId}"]` : null
      },
      {
        name: 'aria-label',
        priority: 8,
        confidence: 0.9,
        generateSelector: (attrs) => 
          attrs.ariaLabel ? `[aria-label="${attrs.ariaLabel}"]` : null
      },
      {
        name: 'role-and-text',
        priority: 7,
        confidence: 0.85,
        generateSelector: (attrs) => {
          if (attrs.role && attrs.text) {
            return `[role="${attrs.role}"]:has-text("${attrs.text}")`;
          }
          return null;
        }
      },
      {
        name: 'text-content',
        priority: 6,
        confidence: 0.8,
        generateSelector: (attrs) => 
          attrs.text ? `text="${attrs.text}"` : null
      },
      {
        name: 'partial-text',
        priority: 5,
        confidence: 0.75,
        generateSelector: (attrs) => {
          if (attrs.text && attrs.text.length > 10) {
            const partial = attrs.text.substring(0, 20);
            return `text*="${partial}"`;
          }
          return null;
        }
      },
      {
        name: 'tag-and-class',
        priority: 4,
        confidence: 0.7,
        generateSelector: (attrs) => {
          if (attrs.tag && attrs.class && attrs.class.length > 0) {
            const mainClass = attrs.class[0];
            return `${attrs.tag}.${mainClass}`;
          }
          return null;
        }
      },
      {
        name: 'form-attributes',
        priority: 6,
        confidence: 0.85,
        generateSelector: (attrs) => {
          if (attrs.name) return `[name="${attrs.name}"]`;
          if (attrs.placeholder) return `[placeholder="${attrs.placeholder}"]`;
          if (attrs.type && attrs.tag === 'input') {
            return `input[type="${attrs.type}"]`;
          }
          return null;
        }
      },
      {
        name: 'position-based',
        priority: 3,
        confidence: 0.65,
        generateSelector: (attrs) => {
          if (attrs.position && attrs.tag) {
            return `${attrs.tag}:nth-of-type(${attrs.position.index + 1})`;
          }
          return null;
        }
      },
      {
        name: 'nearby-text',
        priority: 2,
        confidence: 0.6,
        generateSelector: (attrs) => {
          if (attrs.nearbyText && attrs.nearbyText.length > 0 && attrs.tag) {
            const nearText = attrs.nearbyText[0];
            return `${attrs.tag}:near(:text("${nearText}"))`;
          }
          return null;
        }
      },
      {
        name: 'xpath-fallback',
        priority: 1,
        confidence: 0.5,
        generateSelector: (attrs) => {
          if (attrs.ancestors && attrs.ancestors.length > 0) {
            const path = attrs.ancestors.slice(-3).join('/');
            return `xpath=//${path}/${attrs.tag}`;
          }
          return null;
        }
      }
    ];

    this.healingStrategies.sort((a, b) => b.priority - a.priority);
  }

  async findElement(
    page: Page,
    originalSelector: string,
    options?: { timeout?: number; strict?: boolean }
  ): Promise<{ element: ElementHandle | null; healingResult?: HealingResult }> {
    const startTime = Date.now();
    const timeout = options?.timeout || 5000;
    const strict = options?.strict !== false;

    try {
      const element = await page.$(originalSelector);
      if (element) {
        await this.recordSuccess(originalSelector, element);
        return { element };
      }
    } catch (error) {
      console.log(`Original selector failed: ${originalSelector}`);
    }

    const healingResult = await this.healSelector(page, originalSelector, timeout);
    
    if (healingResult.success && healingResult.selector) {
      try {
        const element = await page.$(healingResult.selector);
        if (element) {
          await this.recordHealing(originalSelector, healingResult.selector, element);
          return { element, healingResult };
        }
      } catch (error) {
        console.error(`Healed selector also failed: ${healingResult.selector}`);
      }
    }

    if (!strict) {
      const fuzzyResult = await this.fuzzyFind(page, originalSelector);
      if (fuzzyResult) {
        return { element: fuzzyResult, healingResult };
      }
    }

    return { element: null, healingResult };
  }

  private async healSelector(
    page: Page,
    originalSelector: string,
    _timeout: number
  ): Promise<HealingResult> {
    const startTime = Date.now();
    const alternatives: string[] = [];
    let attempts = 0;

    const history = this.selectorHistory.get(originalSelector);
    if (history && history.length > 0) {
      for (const histEntry of history) {
        if (histEntry.confidence > this.minConfidenceThreshold) {
          attempts++;
          try {
            const element = await page.$(histEntry.selector);
            if (element) {
              return {
                success: true,
                selector: histEntry.selector,
                strategy: 'history',
                confidence: histEntry.confidence,
                attempts,
                alternatives,
                healingTime: Date.now() - startTime
              };
            }
          } catch (error) {
            histEntry.failureCount++;
            histEntry.confidence *= 0.9;
          }
        }
      }
    }

    const attributes = await this.extractAttributesFromPage(page, originalSelector);
    if (!attributes) {
      return {
        success: false,
        selector: null,
        strategy: null,
        confidence: 0,
        attempts,
        alternatives,
        healingTime: Date.now() - startTime
      };
    }

    for (const strategy of this.healingStrategies) {
      if (attempts >= this.maxHealingAttempts) break;
      
      const selector = strategy.generateSelector(attributes);
      if (!selector) continue;
      
      attempts++;
      alternatives.push(selector);
      
      try {
        const elements = await page.$$(selector);
        if (elements.length === 1) {
          return {
            success: true,
            selector,
            strategy: strategy.name,
            confidence: strategy.confidence,
            attempts,
            alternatives,
            healingTime: Date.now() - startTime
          };
        } else if (elements.length > 1) {
          const refined = await this.refineSelector(page, selector, attributes);
          if (refined) {
            return {
              success: true,
              selector: refined,
              strategy: `${strategy.name}-refined`,
              confidence: strategy.confidence * 0.9,
              attempts: attempts + 1,
              alternatives,
              healingTime: Date.now() - startTime
            };
          }
        }
      } catch (error) {
        console.log(`Strategy ${strategy.name} failed: ${error}`);
      }
    }

    const combinedSelector = await this.generateCombinedSelector(page, attributes);
    if (combinedSelector) {
      attempts++;
      alternatives.push(combinedSelector);
      try {
        const element = await page.$(combinedSelector);
        if (element) {
          return {
            success: true,
            selector: combinedSelector,
            strategy: 'combined',
            confidence: 0.7,
            attempts,
            alternatives,
            healingTime: Date.now() - startTime
          };
        }
      } catch (error) {
        console.log(`Combined selector failed: ${error}`);
      }
    }

    return {
      success: false,
      selector: null,
      strategy: null,
      confidence: 0,
      attempts,
      alternatives,
      healingTime: Date.now() - startTime
    };
  }

  private async extractAttributesFromPage(
    page: Page,
    originalSelector: string
  ): Promise<SelectorAttributes | null> {
    try {
      const attributes = await page.evaluate((selector) => {
        const extractFromElement = (el: Element): any => {
          const rect = el.getBoundingClientRect();
          const parent = el.parentElement;
          const siblings = parent ? Array.from(parent.children) : [];
          
          const ancestors: string[] = [];
          let current = el.parentElement;
          while (current && ancestors.length < 5) {
            ancestors.push(current.tagName.toLowerCase());
            current = current.parentElement;
          }

          const nearbyElements = document.elementsFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );
          
          const nearbyText = nearbyElements
            .slice(0, 3)
            .map(e => e.textContent?.trim())
            .filter(t => t && t.length > 0);

          return {
            id: el.id || undefined,
            class: el.className ? el.className.split(' ').filter(c => c) : [],
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.trim(),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            type: el.getAttribute('type'),
            name: el.getAttribute('name'),
            placeholder: el.getAttribute('placeholder'),
            value: el.getAttribute('value'),
            href: el.getAttribute('href'),
            src: el.getAttribute('src'),
            alt: el.getAttribute('alt'),
            title: el.getAttribute('title'),
            dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test-id'),
            position: {
              index: siblings.indexOf(el),
              parentTag: parent?.tagName.toLowerCase(),
              siblingCount: siblings.length
            },
            ancestors,
            nearbyText
          };
        };

        try {
          const element = document.querySelector(selector);
          if (element) {
            return extractFromElement(element);
          }
        } catch (e) {
          console.log('Selector failed, attempting fuzzy match');
        }

        const textMatch = selector.match(/text[=*]"([^"]+)"/);
        if (textMatch) {
          const text = textMatch[1];
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let node;
          while (node = walker.nextNode()) {
            if (node.textContent?.includes(text)) {
              const element = node.parentElement;
              if (element) {
                return extractFromElement(element);
              }
            }
          }
        }

        return null;
      }, originalSelector);

      return attributes;
    } catch (error) {
      console.error('Failed to extract attributes:', error);
      return null;
    }
  }

  private async refineSelector(
    page: Page,
    selector: string,
    attributes: SelectorAttributes
  ): Promise<string | null> {
    const refinements = [];

    if (attributes.position?.index !== undefined) {
      refinements.push(`${selector}:nth-of-type(${attributes.position.index + 1})`);
    }

    if (attributes.text) {
      refinements.push(`${selector}:has-text("${attributes.text}")`);
    }

    if (attributes.position?.parentTag) {
      refinements.push(`${attributes.position.parentTag} > ${selector}`);
    }

    for (const refined of refinements) {
      try {
        const elements = await page.$$(refined);
        if (elements.length === 1) {
          return refined;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  private async generateCombinedSelector(
    page: Page,
    attributes: SelectorAttributes
  ): Promise<string | null> {
    const parts: string[] = [];

    if (attributes.tag) {
      parts.push(attributes.tag);
    }

    if (attributes.class && attributes.class.length > 0) {
      const stableClasses = attributes.class.filter(c => 
        !c.match(/^(active|selected|hover|focus|disabled)/)
      );
      if (stableClasses.length > 0) {
        parts.push(`.${stableClasses[0]}`);
      }
    }

    const attributeSelectors: string[] = [];
    
    if (attributes.role) {
      attributeSelectors.push(`[role="${attributes.role}"]`);
    }
    
    if (attributes.type && attributes.tag === 'input') {
      attributeSelectors.push(`[type="${attributes.type}"]`);
    }

    if (attributeSelectors.length > 0) {
      parts.push(attributeSelectors.join(''));
    }

    if (attributes.text && attributes.text.length < 50) {
      parts.push(`:has-text("${attributes.text}")`);
    }

    const combined = parts.join('');
    
    if (combined && combined !== attributes.tag) {
      try {
        const elements = await page.$$(combined);
        if (elements.length === 1) {
          return combined;
        }
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  private async fuzzyFind(
    page: Page,
    originalSelector: string
  ): Promise<ElementHandle | null> {
    const fuzzyStrategies = [
      async () => {
        const partial = originalSelector.replace(/["\[\]]/g, '');
        if (partial.length > 3) {
          return await page.$(`*:has-text("${partial}")`);
        }
        return null;
      },
      async () => {
        const words = originalSelector.match(/\w+/g);
        if (words && words.length > 0) {
          for (const word of words) {
            const element = await page.$(`*:has-text("${word}")`);
            if (element) return element;
          }
        }
        return null;
      },
      async () => {
        const tagMatch = originalSelector.match(/^(\w+)/);
        if (tagMatch) {
          return await page.$(tagMatch[1]);
        }
        return null;
      }
    ];

    for (const strategy of fuzzyStrategies) {
      try {
        const element = await strategy();
        if (element) {
          return element;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  private async recordSuccess(selector: string, element: ElementHandle): Promise<void> {
    if (!this.learningMode) return;

    try {
      const attributes = await element.evaluate((el: HTMLElement) => {
        return {
          id: el.id || undefined,
          class: el.className ? el.className.split(' ').filter((c: string) => c) : [],
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim()?.substring(0, 100),
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label'),
          dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test-id')
        };
      });

      const history = this.selectorHistory.get(selector) || [];
      const entry = history.find(h => h.selector === selector);
      
      if (entry) {
        entry.successCount++;
        entry.lastWorked = new Date();
        entry.confidence = Math.min(1.0, entry.confidence * 1.05);
      } else {
        history.push({
          selector,
          attributes: attributes as SelectorAttributes,
          lastWorked: new Date(),
          successCount: 1,
          failureCount: 0,
          confidence: 0.8
        });
      }

      if (history.length > this.maxHistorySize) {
        history.sort((a, b) => b.confidence - a.confidence);
        history.splice(this.maxHistorySize);
      }

      this.selectorHistory.set(selector, history);
    } catch (error) {
      console.error('Failed to record success:', error);
    }
  }

  private async recordHealing(
    originalSelector: string,
    healedSelector: string,
    element: ElementHandle
  ): Promise<void> {
    if (!this.learningMode) return;

    await this.recordSuccess(healedSelector, element);

    const history = this.selectorHistory.get(originalSelector) || [];
    const healedEntry = history.find(h => h.selector === healedSelector);
    
    if (!healedEntry) {
      try {
        const attributes = await element.evaluate((el: HTMLElement) => {
          return {
            id: el.id || undefined,
            class: el.className ? el.className.split(' ').filter((c: string) => c) : [],
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.trim()?.substring(0, 100),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test-id')
          };
        });

        history.push({
          selector: healedSelector,
          attributes: attributes as SelectorAttributes,
          lastWorked: new Date(),
          successCount: 1,
          failureCount: 0,
          confidence: 0.7
        });

        this.selectorHistory.set(originalSelector, history);
      } catch (error) {
        console.error('Failed to record healing:', error);
      }
    }
  }

  public exportHistory(): string {
    const data = Array.from(this.selectorHistory.entries()).map(([key, value]) => ({
      originalSelector: key,
      alternatives: value.map(v => ({
        selector: v.selector,
        confidence: v.confidence,
        successCount: v.successCount,
        failureCount: v.failureCount,
        lastWorked: v.lastWorked
      }))
    }));

    return JSON.stringify(data, null, 2);
  }

  public importHistory(data: string): void {
    try {
      const parsed = JSON.parse(data);
      for (const item of parsed) {
        const history: SelectorHistory[] = item.alternatives.map((alt: any) => ({
          ...alt,
          lastWorked: new Date(alt.lastWorked),
          attributes: {}
        }));
        this.selectorHistory.set(item.originalSelector, history);
      }
    } catch (error) {
      console.error('Failed to import history:', error);
    }
  }

  public clearHistory(): void {
    this.selectorHistory.clear();
  }

  public setLearningMode(enabled: boolean): void {
    this.learningMode = enabled;
  }

  public getStatistics(): {
    totalSelectors: number;
    totalAlternatives: number;
    averageConfidence: number;
    mostReliable: string[];
    recentFailures: string[];
  } {
    let totalAlternatives = 0;
    let totalConfidence = 0;
    const allSelectors: { selector: string; confidence: number }[] = [];
    const failures: { selector: string; failureCount: number }[] = [];

    for (const [original, history] of this.selectorHistory.entries()) {
      for (const entry of history) {
        totalAlternatives++;
        totalConfidence += entry.confidence;
        allSelectors.push({ selector: entry.selector, confidence: entry.confidence });
        
        if (entry.failureCount > 0) {
          failures.push({ selector: original, failureCount: entry.failureCount });
        }
      }
    }

    allSelectors.sort((a, b) => b.confidence - a.confidence);
    failures.sort((a, b) => b.failureCount - a.failureCount);

    return {
      totalSelectors: this.selectorHistory.size,
      totalAlternatives,
      averageConfidence: totalAlternatives > 0 ? totalConfidence / totalAlternatives : 0,
      mostReliable: allSelectors.slice(0, 5).map(s => s.selector),
      recentFailures: failures.slice(0, 5).map(f => f.selector)
    };
  }
}