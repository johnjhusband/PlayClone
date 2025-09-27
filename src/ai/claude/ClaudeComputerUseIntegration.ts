import { Page, ElementHandle } from 'playwright-core';
import { ActionResult } from '../../types';

// Simple logger for Claude Computer Use
class Logger {
  private prefix: string;
  
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  
  info(message: string, ...args: any[]) {
    console.log(`[${this.prefix}] ${message}`, ...args);
  }
  
  debug(message: string, ...args: any[]) {
    if (process.env.DEBUG) {
      console.log(`[${this.prefix}:DEBUG] ${message}`, ...args);
    }
  }
  
  error(message: string, ...args: any[]) {
    console.error(`[${this.prefix}:ERROR] ${message}`, ...args);
  }
}

interface ComputerUseConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  enableScreenshots?: boolean;
  debugMode?: boolean;
}

interface ScreenInteraction {
  type: 'click' | 'type' | 'scroll' | 'drag' | 'hover';
  coordinates?: { x: number; y: number };
  text?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
}

interface VisualElement {
  type: string;
  text?: string;
  bounds: { x: number; y: number; width: number; height: number };
  confidence: number;
  attributes?: Record<string, any>;
}

export class ClaudeComputerUseIntegration {
  private page: Page | null = null;
  private config: ComputerUseConfig;
  private logger: Logger;
  private screenBuffer: Buffer | null = null;
  private lastInteraction: ScreenInteraction | null = null;
  private visualElements: VisualElement[] = [];

  constructor(config: ComputerUseConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      model: config.model || 'claude-3-sonnet-20240229',
      maxTokens: config.maxTokens || 1024,
      temperature: config.temperature || 0,
      enableScreenshots: config.enableScreenshots !== false,
      debugMode: config.debugMode || false
    };
    this.logger = new Logger('ClaudeComputerUse');
  }

  async initialize(page: Page): Promise<void> {
    this.page = page;
    if (this.config.enableScreenshots) {
      await this.captureScreen();
    }
    this.logger.info('Claude Computer Use integration initialized');
  }

  /**
   * Capture current screen state
   */
  async captureScreen(): Promise<Buffer> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    this.screenBuffer = await this.page.screenshot({
      fullPage: false,
      type: 'png'
    });

    if (this.config.debugMode) {
      this.logger.debug(`Screen captured: ${this.screenBuffer.length} bytes`);
    }

    return this.screenBuffer;
  }

  /**
   * Perform direct screen interaction using coordinates
   */
  async interactWithScreen(interaction: ScreenInteraction): Promise<ActionResult> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      this.lastInteraction = interaction;

      switch (interaction.type) {
        case 'click':
          if (!interaction.coordinates) {
            throw new Error('Click requires coordinates');
          }
          await this.page.mouse.click(
            interaction.coordinates.x,
            interaction.coordinates.y
          );
          break;

        case 'type':
          if (!interaction.text) {
            throw new Error('Type requires text');
          }
          await this.page.keyboard.type(interaction.text);
          break;

        case 'scroll':
          await this.handleScroll(interaction);
          break;

        case 'drag':
          await this.handleDrag(interaction);
          break;

        case 'hover':
          if (!interaction.coordinates) {
            throw new Error('Hover requires coordinates');
          }
          await this.page.mouse.move(
            interaction.coordinates.x,
            interaction.coordinates.y
          );
          break;

        default:
          throw new Error(`Unknown interaction type: ${interaction.type}`);
      }

      // Capture screen after interaction
      if (this.config.enableScreenshots) {
        await this.captureScreen();
      }

      return {
        success: true,
        action: 'interactWithScreen',
        value: `${interaction.type} completed`,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        action: 'interactWithScreen',
        value: undefined,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Detect visual elements on the screen using Computer Use API
   */
  async detectVisualElements(): Promise<VisualElement[]> {
    if (!this.screenBuffer) {
      await this.captureScreen();
    }

    try {
      // Simulate visual element detection
      // In production, this would call Claude's Computer Use API
      this.visualElements = await this.simulateVisualDetection();

      if (this.config.debugMode) {
        this.logger.debug(`Detected ${this.visualElements.length} visual elements`);
      }

      return this.visualElements;
    } catch (error) {
      this.logger.error('Visual element detection failed:', error);
      return [];
    }
  }

  /**
   * Find element by visual description
   */
  async findElementByVisualDescription(
    description: string
  ): Promise<VisualElement | null> {
    if (this.visualElements.length === 0) {
      await this.detectVisualElements();
    }

    // Use AI to match description with visual elements
    const normalizedDesc = description.toLowerCase();
    
    for (const element of this.visualElements) {
      const elementText = (element.text || '').toLowerCase();
      const elementType = element.type.toLowerCase();

      // Simple matching logic - would use AI in production
      if (
        elementText.includes(normalizedDesc) ||
        normalizedDesc.includes(elementType) ||
        (element.attributes?.ariaLabel || '').toLowerCase().includes(normalizedDesc)
      ) {
        return element;
      }
    }

    return null;
  }

  /**
   * Perform hybrid text/visual element selection
   */
  async selectElementHybrid(
    selector: string,
    visualHint?: string
  ): Promise<ElementHandle | null> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      // Try text-based selection first
      const elements = await this.page.$$(selector);
      
      if (elements.length === 0) {
        // Fall back to visual selection
        if (visualHint) {
          const visualElement = await this.findElementByVisualDescription(visualHint);
          if (visualElement) {
            // Click at the center of the visual element
            const centerX = visualElement.bounds.x + visualElement.bounds.width / 2;
            const centerY = visualElement.bounds.y + visualElement.bounds.height / 2;
            
            await this.page.mouse.click(centerX, centerY);
            
            // Try to get the element at that position
            const element = await this.page.evaluateHandle(
              (coords) => document.elementFromPoint(coords.x, coords.y),
              { x: centerX, y: centerY }
            );
            
            // Check if it's an element handle
            const asElement = element.asElement();
            return asElement || null;
          }
        }
        return null;
      }

      if (elements.length === 1) {
        return elements[0];
      }

      // Multiple elements found - use visual hint to disambiguate
      if (visualHint) {
        const visualElement = await this.findElementByVisualDescription(visualHint);
        if (visualElement) {
          // Find the text element closest to the visual element
          const closest = await this.findClosestElement(elements, visualElement.bounds);
          return closest;
        }
      }

      // Return first element as fallback
      return elements[0];
    } catch (error) {
      this.logger.error('Hybrid element selection failed:', error);
      return null;
    }
  }

  /**
   * Understand and describe the current UI
   */
  async understandUI(): Promise<ActionResult> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      await this.captureScreen();
      const elements = await this.detectVisualElements();

      // Group elements by type
      const elementsByType: Record<string, number> = {};
      for (const element of elements) {
        elementsByType[element.type] = (elementsByType[element.type] || 0) + 1;
      }

      // Find interactive elements
      const interactiveElements = elements.filter(el => 
        ['button', 'link', 'input', 'select', 'checkbox', 'radio'].includes(el.type)
      );

      // Find text content
      const textElements = elements.filter(el => 
        el.text && el.text.trim().length > 0
      );

      const understanding = {
        totalElements: elements.length,
        elementTypes: elementsByType,
        interactiveCount: interactiveElements.length,
        textCount: textElements.length,
        primaryActions: interactiveElements
          .slice(0, 5)
          .map(el => ({
            type: el.type,
            text: el.text,
            position: `${el.bounds.x},${el.bounds.y}`
          })),
        pageStructure: this.analyzePageStructure(elements)
      };

      return {
        success: true,
        action: 'understandUI',
        value: JSON.stringify(understanding, null, 2),
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        action: 'understandUI',
        value: undefined,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a complex automation flow using visual understanding
   */
  async executeVisualFlow(
    steps: Array<{ action: string; target?: string; value?: string }>
  ): Promise<ActionResult> {
    const results: any[] = [];

    for (const step of steps) {
      try {
        let result: any;

        switch (step.action) {
          case 'click':
            if (step.target) {
              const element = await this.findElementByVisualDescription(step.target);
              if (element) {
                const centerX = element.bounds.x + element.bounds.width / 2;
                const centerY = element.bounds.y + element.bounds.height / 2;
                await this.interactWithScreen({
                  type: 'click',
                  coordinates: { x: centerX, y: centerY }
                });
                result = { action: 'click', target: step.target, success: true };
              } else {
                result = { action: 'click', target: step.target, success: false, error: 'Element not found' };
              }
            }
            break;

          case 'type':
            if (step.value) {
              await this.interactWithScreen({
                type: 'type',
                text: step.value
              });
              result = { action: 'type', value: step.value, success: true };
            }
            break;

          case 'scroll':
            await this.interactWithScreen({
              type: 'scroll',
              direction: 'down',
              distance: 500
            });
            result = { action: 'scroll', success: true };
            break;

          case 'wait':
            await new Promise(resolve => setTimeout(resolve, parseInt(step.value || '1000')));
            result = { action: 'wait', duration: step.value, success: true };
            break;

          default:
            result = { action: step.action, success: false, error: 'Unknown action' };
        }

        results.push(result);

        // Update visual elements after each action
        if (this.config.enableScreenshots) {
          await this.detectVisualElements();
        }
      } catch (error) {
        results.push({
          action: step.action,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: successCount === steps.length,
      action: 'executeVisualFlow',
      value: JSON.stringify({
        totalSteps: steps.length,
        successfulSteps: successCount,
        results: results
      }, null, 2),
      timestamp: Date.now(),
      error: successCount < steps.length ? 'Some steps failed' : undefined
    };
  }

  /**
   * Get visual debugging information
   */
  async getVisualDebugInfo(): Promise<ActionResult> {
    if (!this.screenBuffer) {
      await this.captureScreen();
    }

    const debugInfo = {
      screenSize: this.screenBuffer ? this.screenBuffer.length : 0,
      lastInteraction: this.lastInteraction,
      detectedElements: this.visualElements.length,
      elementTypes: [...new Set(this.visualElements.map(e => e.type))],
      highConfidenceElements: this.visualElements.filter(e => e.confidence > 0.8).length,
      config: {
        model: this.config.model,
        screenshotsEnabled: this.config.enableScreenshots,
        debugMode: this.config.debugMode
      }
    };

    return {
      success: true,
      action: 'getVisualDebugInfo',
      value: JSON.stringify(debugInfo, null, 2),
      timestamp: Date.now()
    };
  }

  // Private helper methods

  private async handleScroll(interaction: ScreenInteraction): Promise<void> {
    if (!this.page) return;

    const distance = interaction.distance || 100;
    const direction = interaction.direction || 'down';

    switch (direction) {
      case 'down':
        await this.page.mouse.wheel(0, distance);
        break;
      case 'up':
        await this.page.mouse.wheel(0, -distance);
        break;
      case 'right':
        await this.page.mouse.wheel(distance, 0);
        break;
      case 'left':
        await this.page.mouse.wheel(-distance, 0);
        break;
    }
  }

  private async handleDrag(interaction: ScreenInteraction): Promise<void> {
    if (!this.page || !interaction.coordinates) return;

    const startX = interaction.coordinates.x;
    const startY = interaction.coordinates.y;
    const distance = interaction.distance || 100;

    let endX = startX;
    let endY = startY;

    switch (interaction.direction) {
      case 'right':
        endX += distance;
        break;
      case 'left':
        endX -= distance;
        break;
      case 'down':
        endY += distance;
        break;
      case 'up':
        endY -= distance;
        break;
    }

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY);
    await this.page.mouse.up();
  }

  private async simulateVisualDetection(): Promise<VisualElement[]> {
    if (!this.page) return [];

    // Simulate visual detection by analyzing the DOM
    // In production, this would use Claude's Computer Use API
    const elements = await this.page.evaluate(() => {
      const results: any[] = [];
      const interactiveSelectors = [
        'button', 'a', 'input', 'select', 'textarea',
        '[role="button"]', '[role="link"]', '[onclick]'
      ];

      interactiveSelectors.forEach(selector => {
        const els = document.querySelectorAll(selector);
        els.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            results.push({
              type: el.tagName.toLowerCase(),
              text: (el as HTMLElement).innerText || (el as HTMLInputElement).value || '',
              bounds: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              },
              confidence: 0.95,
              attributes: {
                ariaLabel: el.getAttribute('aria-label'),
                role: el.getAttribute('role'),
                href: (el as HTMLAnchorElement).href
              }
            });
          }
        });
      });

      return results;
    });

    return elements;
  }

  private async findClosestElement(
    elements: ElementHandle[],
    targetBounds: { x: number; y: number; width: number; height: number }
  ): Promise<ElementHandle | null> {
    let closestElement: ElementHandle | null = null;
    let minDistance = Infinity;

    for (const element of elements) {
      const box = await element.boundingBox();
      if (!box) continue;

      const elementCenterX = box.x + box.width / 2;
      const elementCenterY = box.y + box.height / 2;
      const targetCenterX = targetBounds.x + targetBounds.width / 2;
      const targetCenterY = targetBounds.y + targetBounds.height / 2;

      const distance = Math.sqrt(
        Math.pow(elementCenterX - targetCenterX, 2) +
        Math.pow(elementCenterY - targetCenterY, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestElement = element;
      }
    }

    return closestElement;
  }

  private analyzePageStructure(elements: VisualElement[]): any {
    // Analyze page layout and structure
    const regions = {
      header: elements.filter(e => e.bounds.y < 200),
      footer: elements.filter(e => e.bounds.y > 600),
      sidebar: elements.filter(e => e.bounds.x < 200 || e.bounds.x > 1000),
      main: elements.filter(e => 
        e.bounds.x >= 200 && 
        e.bounds.x <= 1000 && 
        e.bounds.y >= 200 && 
        e.bounds.y <= 600
      )
    };

    return {
      headerElements: regions.header.length,
      footerElements: regions.footer.length,
      sidebarElements: regions.sidebar.length,
      mainContentElements: regions.main.length,
      layout: this.detectLayout(regions)
    };
  }

  private detectLayout(regions: any): string {
    if (regions.sidebar.length > 10) {
      return 'sidebar-layout';
    }
    if (regions.header.length > 5 && regions.footer.length > 5) {
      return 'traditional-layout';
    }
    if (regions.main.length > regions.header.length + regions.footer.length) {
      return 'content-focused';
    }
    return 'mixed-layout';
  }
}