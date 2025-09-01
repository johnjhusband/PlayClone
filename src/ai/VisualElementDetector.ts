/**
 * Visual Element Detection using Computer Vision
 * Identifies and locates UI elements through visual analysis
 */

import { Page } from 'playwright-core';
import { ActionResult } from '../types';
import { formatResponse, formatError } from '../utils/responseFormatter';

export interface VisualElement {
  type: 'button' | 'input' | 'link' | 'image' | 'text' | 'icon' | 'menu' | 'modal' | 'unknown';
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  text?: string;
  attributes?: Record<string, string>;
  visualProperties?: {
    backgroundColor?: string;
    textColor?: string;
    borderStyle?: string;
    isVisible?: boolean;
    zIndex?: number;
  };
}

export interface VisualDetectionOptions {
  threshold?: number; // Confidence threshold (0-1)
  includeHidden?: boolean;
  analyzeColors?: boolean;
  detectPatterns?: boolean;
  maxElements?: number;
}

export class VisualElementDetector {
  private page: Page;
  private cache: Map<string, VisualElement[]> = new Map();

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Detect all visual elements on the page
   */
  async detectElements(options: VisualDetectionOptions = {}): Promise<ActionResult> {
    const {
      threshold = 0.5,
      includeHidden = false,
      analyzeColors = true,
      detectPatterns = true,
      maxElements = 100
    } = options;

    try {
      // Take screenshot for analysis (could be used for future ML integration)
      await this.page.screenshot({ fullPage: true });
      
      // Get page dimensions
      const dimensions = await this.page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }));

      // Analyze DOM elements with visual properties
      const elements = await this.page.evaluate((opts) => {
        const results: any[] = [];
        const processed = new Set<Element>();

        // Helper to get computed styles
        const getVisualProperties = (el: Element) => {
          const styles = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          
          return {
            backgroundColor: styles.backgroundColor,
            textColor: styles.color,
            borderStyle: `${styles.borderStyle} ${styles.borderWidth} ${styles.borderColor}`,
            isVisible: styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
            zIndex: parseInt(styles.zIndex) || 0
          };
        };

        // Helper to detect element type
        const detectElementType = (el: Element): string => {
          const tagName = el.tagName.toLowerCase();
          const role = el.getAttribute('role');
          const type = el.getAttribute('type');
          
          // Check for buttons
          if (tagName === 'button' || role === 'button' || type === 'button' || type === 'submit') {
            return 'button';
          }
          
          // Check for inputs
          if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            return 'input';
          }
          
          // Check for links
          if (tagName === 'a' || role === 'link') {
            return 'link';
          }
          
          // Check for images
          if (tagName === 'img' || tagName === 'svg' || role === 'img') {
            return 'image';
          }
          
          // Check for menus
          if (role === 'menu' || role === 'menubar' || role === 'navigation' || tagName === 'nav') {
            return 'menu';
          }
          
          // Check for modals/dialogs
          if (role === 'dialog' || role === 'alertdialog' || el.classList.contains('modal')) {
            return 'modal';
          }
          
          // Check for icons (common patterns)
          if (el.classList.toString().match(/icon|fa-|material-icons|svg-icon/i)) {
            return 'icon';
          }
          
          // Default to text if has text content
          if (el.textContent?.trim()) {
            return 'text';
          }
          
          return 'unknown';
        };

        // Analyze clickable elements
        const clickableSelectors = [
          'button', 'a', '[role="button"]', '[role="link"]',
          'input[type="submit"]', 'input[type="button"]',
          '[onclick]', '[ng-click]', '[data-click]',
          '.btn', '.button', '.link'
        ];

        clickableSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            if (processed.has(el)) return;
            processed.add(el);

            const rect = el.getBoundingClientRect();
            const visualProps = getVisualProperties(el);
            
            if (!opts.includeHidden && !visualProps.isVisible) return;
            if (results.length >= opts.maxElements) return;

            results.push({
              type: detectElementType(el),
              boundingBox: {
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY,
                width: rect.width,
                height: rect.height
              },
              confidence: 0.8, // High confidence for DOM elements
              text: (el.textContent || '').trim().substring(0, 100),
              attributes: {
                id: el.id || undefined,
                class: el.className || undefined,
                href: (el as any).href || undefined,
                src: (el as any).src || undefined
              },
              visualProperties: opts.analyzeColors ? visualProps : undefined
            });
          });
        });

        // Analyze form elements
        document.querySelectorAll('input, textarea, select').forEach(el => {
          if (processed.has(el)) return;
          processed.add(el);

          const rect = el.getBoundingClientRect();
          const visualProps = getVisualProperties(el);
          
          if (!opts.includeHidden && !visualProps.isVisible) return;
          if (results.length >= opts.maxElements) return;

          results.push({
            type: 'input',
            boundingBox: {
              x: rect.left + window.scrollX,
              y: rect.top + window.scrollY,
              width: rect.width,
              height: rect.height
            },
            confidence: 0.9,
            text: (el as any).placeholder || (el as any).value || '',
            attributes: {
              id: el.id || undefined,
              name: (el as any).name || undefined,
              type: (el as any).type || undefined
            },
            visualProperties: opts.analyzeColors ? visualProps : undefined
          });
        });

        // Detect visual patterns (cards, grids, lists)
        if (opts.detectPatterns) {
          // Detect cards
          const cardSelectors = ['.card', '.panel', '.box', '[role="article"]'];
          cardSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
              if (processed.has(el)) return;
              processed.add(el);

              el.getBoundingClientRect();
              const visualProps = getVisualProperties(el);
              
              if (!opts.includeHidden && !visualProps.isVisible) return;
              if (results.length >= opts.maxElements) return;

              // Look for buttons within cards
              el.querySelectorAll('button, a, [role="button"]').forEach(child => {
                if (processed.has(child)) return;
                processed.add(child);

                const childRect = child.getBoundingClientRect();
                results.push({
                  type: detectElementType(child),
                  boundingBox: {
                    x: childRect.left + window.scrollX,
                    y: childRect.top + window.scrollY,
                    width: childRect.width,
                    height: childRect.height
                  },
                  confidence: 0.7,
                  text: (child.textContent || '').trim().substring(0, 100),
                  visualProperties: opts.analyzeColors ? getVisualProperties(child) : undefined
                });
              });
            });
          });
        }

        return results;
      }, {
        threshold,
        includeHidden,
        analyzeColors,
        detectPatterns,
        maxElements
      });

      // Filter by confidence threshold
      const filtered = elements.filter((el: any) => el.confidence >= threshold);

      // Sort by visual prominence (size and position)
      filtered.sort((a: any, b: any) => {
        const areaA = a.boundingBox.width * a.boundingBox.height;
        const areaB = b.boundingBox.width * b.boundingBox.height;
        const posA = a.boundingBox.y;
        const posB = b.boundingBox.y;
        
        // Prioritize larger elements higher on the page
        return (posA - posB) || (areaB - areaA);
      });

      return formatResponse({
        success: true,
        action: 'ai_operation',
        timestamp: Date.now(),
        value: {
          elements: filtered,
          dimensions,
          count: filtered.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      return formatError(error as Error, 'Failed to detect visual elements');
    }
  }

  /**
   * Find elements matching visual description
   */
  async findByVisualDescription(description: string): Promise<ActionResult> {
    try {
      // Parse visual description
      const patterns = this.parseVisualDescription(description);
      
      // Detect all elements
      const detection = await this.detectElements({
        threshold: 0.3,
        analyzeColors: true,
        detectPatterns: true
      });

      if (!detection.success) {
        return detection;
      }

      const elements = (detection as any).elements as VisualElement[];
      
      // Score each element based on description match
      const scored = elements.map(el => ({
        ...el,
        score: this.scoreVisualMatch(el, patterns)
      }));

      // Filter and sort by score
      const matches = scored
        .filter(el => el.score > 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (matches.length === 0) {
        return formatResponse({
          success: false,
          action: 'detectElements',
          error: `No elements matching "${description}" found`,
          timestamp: Date.now()
        });
      }

      return formatResponse({
        success: true,
        action: 'ai_operation',
        timestamp: Date.now(),
        value: {
          found: true,
          matches: matches.map(m => ({
            type: m.type,
            boundingBox: m.boundingBox,
            confidence: m.score,
            text: m.text
          })),
          best: matches[0]
        }
      });

    } catch (error) {
      return formatError(error as Error, 'Failed to find by visual description');
    }
  }

  /**
   * Click element at visual coordinates
   */
  async clickAtVisualElement(element: VisualElement): Promise<ActionResult> {
    try {
      const { x, y, width, height } = element.boundingBox;
      
      // Click at center of element
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      await this.page.mouse.click(centerX, centerY);

      return formatResponse({
        success: true,
        action: 'clickElement',
        value: {
          clicked: true,
          position: { x: centerX, y: centerY },
          element: {
            type: element.type,
            text: element.text
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      return formatError(error as Error, 'Failed to click visual element');
    }
  }

  /**
   * Highlight visual elements for debugging
   */
  async highlightElements(elements: VisualElement[]): Promise<ActionResult> {
    try {
      await this.page.evaluate((els) => {
        // Remove existing highlights
        document.querySelectorAll('.playclone-highlight').forEach(el => el.remove());

        els.forEach((element: any) => {
          const div = document.createElement('div');
          div.className = 'playclone-highlight';
          div.style.position = 'absolute';
          div.style.left = `${element.boundingBox.x}px`;
          div.style.top = `${element.boundingBox.y}px`;
          div.style.width = `${element.boundingBox.width}px`;
          div.style.height = `${element.boundingBox.height}px`;
          div.style.border = '2px solid red';
          div.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
          div.style.pointerEvents = 'none';
          div.style.zIndex = '99999';
          
          // Add label
          const label = document.createElement('div');
          label.style.position = 'absolute';
          label.style.top = '-20px';
          label.style.left = '0';
          label.style.backgroundColor = 'red';
          label.style.color = 'white';
          label.style.padding = '2px 5px';
          label.style.fontSize = '12px';
          label.style.fontFamily = 'monospace';
          label.textContent = `${element.type} (${Math.round(element.confidence * 100)}%)`;
          div.appendChild(label);

          document.body.appendChild(div);
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
          document.querySelectorAll('.playclone-highlight').forEach(el => el.remove());
        }, 5000);
      }, elements);

      return formatResponse({
        success: true,
        action: 'ai_operation',
        timestamp: Date.now(),
        value: {
          highlighted: elements.length,
          duration: '5 seconds'
        }
      });

    } catch (error) {
      return formatError(error as Error, 'Failed to highlight elements');
    }
  }

  /**
   * Parse visual description into patterns
   */
  private parseVisualDescription(description: string): Record<string, any> {
    const lower = description.toLowerCase();
    const patterns: Record<string, any> = {};

    // Parse colors
    const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'black', 'white', 'gray'];
    colors.forEach(color => {
      if (lower.includes(color)) {
        patterns.color = color;
      }
    });

    // Parse sizes
    if (lower.includes('large') || lower.includes('big')) patterns.size = 'large';
    if (lower.includes('small') || lower.includes('tiny')) patterns.size = 'small';
    if (lower.includes('medium')) patterns.size = 'medium';

    // Parse positions
    if (lower.includes('top')) patterns.position = 'top';
    if (lower.includes('bottom')) patterns.position = 'bottom';
    if (lower.includes('left')) patterns.position = 'left';
    if (lower.includes('right')) patterns.position = 'right';
    if (lower.includes('center')) patterns.position = 'center';

    // Parse types
    if (lower.includes('button')) patterns.type = 'button';
    if (lower.includes('link')) patterns.type = 'link';
    if (lower.includes('input') || lower.includes('field')) patterns.type = 'input';
    if (lower.includes('image') || lower.includes('img')) patterns.type = 'image';

    // Parse text content
    const textMatch = description.match(/"([^"]+)"/);
    if (textMatch) {
      patterns.text = textMatch[1];
    }

    return patterns;
  }

  /**
   * Score how well an element matches visual patterns
   */
  private scoreVisualMatch(element: VisualElement, patterns: Record<string, any>): number {
    let score = 0;
    let maxScore = 0;

    // Type match
    if (patterns.type) {
      maxScore += 1;
      if (element.type === patterns.type) {
        score += 1;
      }
    }

    // Text match
    if (patterns.text && element.text) {
      maxScore += 1;
      const similarity = this.textSimilarity(element.text.toLowerCase(), patterns.text.toLowerCase());
      score += similarity;
    }

    // Color match
    if (patterns.color && element.visualProperties) {
      maxScore += 0.5;
      const props = element.visualProperties;
      if (props.backgroundColor?.includes(patterns.color) || 
          props.textColor?.includes(patterns.color)) {
        score += 0.5;
      }
    }

    // Size match (based on area)
    if (patterns.size) {
      maxScore += 0.5;
      const area = element.boundingBox.width * element.boundingBox.height;
      const isLarge = area > 10000;
      const isSmall = area < 2500;
      const isMedium = !isLarge && !isSmall;
      
      if ((patterns.size === 'large' && isLarge) ||
          (patterns.size === 'small' && isSmall) ||
          (patterns.size === 'medium' && isMedium)) {
        score += 0.5;
      }
    }

    // Position match
    if (patterns.position) {
      maxScore += 0.5;
      const { x, y } = element.boundingBox;
      const pageWidth = 1920; // Assume standard width
      const pageHeight = 1080; // Assume standard height
      
      const isTop = y < pageHeight * 0.3;
      const isBottom = y > pageHeight * 0.7;
      const isLeft = x < pageWidth * 0.3;
      const isRight = x > pageWidth * 0.7;
      const isCenter = !isTop && !isBottom && !isLeft && !isRight;
      
      if ((patterns.position === 'top' && isTop) ||
          (patterns.position === 'bottom' && isBottom) ||
          (patterns.position === 'left' && isLeft) ||
          (patterns.position === 'right' && isRight) ||
          (patterns.position === 'center' && isCenter)) {
        score += 0.5;
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  private textSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1;
    if (text1.includes(text2) || text2.includes(text1)) return 0.8;
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    
    return Math.max(0, 1 - distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
