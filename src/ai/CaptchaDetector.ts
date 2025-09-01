/**
 * CAPTCHA Detection and Flagging System
 * Detects various types of CAPTCHAs and provides information for handling
 */

import { Page, ElementHandle } from 'playwright-core';
import { ActionResult } from '../types';
import { formatResponse, formatError } from '../utils/responseFormatter';

export interface CaptchaInfo {
  type: 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha' | 'funcaptcha' | 'geetest' | 'text' | 'image' | 'audio' | 'puzzle' | 'math' | 'unknown';
  provider?: string;
  visible: boolean;
  interactive: boolean;
  location?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  siteKey?: string;
  challenge?: string;
  iframe?: boolean;
  attributes?: Record<string, string>;
  confidence: number;
}

export interface CaptchaDetectionOptions {
  deepScan?: boolean;
  checkIframes?: boolean;
  timeout?: number;
}

export class CaptchaDetector {
  private page: Page;
  private knownSelectors: Map<string, string[]>;

  constructor(page: Page) {
    this.page = page;
    this.knownSelectors = this.initializeSelectors();
  }

  /**
   * Initialize known CAPTCHA selectors
   */
  private initializeSelectors(): Map<string, string[]> {
    const selectors = new Map<string, string[]>();

    // Google reCAPTCHA v2
    selectors.set('recaptcha-v2', [
      '.g-recaptcha',
      '#g-recaptcha',
      'div[data-sitekey]',
      'iframe[src*="google.com/recaptcha"]',
      'iframe[title="reCAPTCHA"]',
      '.grecaptcha-badge'
    ]);

    // Google reCAPTCHA v3
    selectors.set('recaptcha-v3', [
      '.grecaptcha-badge',
      '[data-action]',
      'iframe[src*="google.com/recaptcha/enterprise"]'
    ]);

    // hCaptcha
    selectors.set('hcaptcha', [
      '.h-captcha',
      '#h-captcha',
      'div[data-hcaptcha-widget-id]',
      'iframe[src*="hcaptcha.com"]',
      'div[data-sitekey][data-callback*="hcaptcha"]'
    ]);

    // FunCaptcha (Arkose Labs)
    selectors.set('funcaptcha', [
      '#funcaptcha',
      '.funcaptcha',
      'div[data-public-key]',
      'iframe[src*="funcaptcha.com"]',
      'iframe[src*="arkoselabs.com"]'
    ]);

    // GeeTest
    selectors.set('geetest', [
      '.geetest_captcha',
      '.geetest_holder',
      'div[data-gt-challenge]',
      '.gt_holder'
    ]);

    // Text-based CAPTCHAs
    selectors.set('text', [
      'img[alt*="captcha" i]',
      'img[src*="captcha" i]',
      'img[id*="captcha" i]',
      'input[name*="captcha" i]',
      'input[placeholder*="captcha" i]',
      '.captcha-image',
      '#captcha-image'
    ]);

    // Image selection CAPTCHAs
    selectors.set('image', [
      '.captcha-select-images',
      'div[class*="image-captcha"]',
      '.rc-imageselect',
      '.captcha-grid'
    ]);

    // Puzzle CAPTCHAs
    selectors.set('puzzle', [
      '.captcha-puzzle',
      '.slider-captcha',
      'div[class*="puzzle-captcha"]',
      '.slide-verify'
    ]);

    return selectors;
  }


  /**
   * Detect CAPTCHAs on the page
   */
  async detect(options: CaptchaDetectionOptions = {}): Promise<ActionResult> {
    const {
      deepScan = true,
      checkIframes = true,
      timeout = 5000
    } = options;

    try {
      const startTime = Date.now();
      const captchas: CaptchaInfo[] = [];

      // Check for known CAPTCHA selectors
      for (const [type, selectors] of this.knownSelectors) {
        for (const selector of selectors) {
          try {
            const elements = await this.page.$$(selector);
            for (const element of elements) {
              const captchaInfo = await this.analyzeCaptchaElement(element, type as any);
              if (captchaInfo) {
                captchas.push(captchaInfo);
              }
            }
          } catch {
            // Continue checking other selectors
          }

          if (Date.now() - startTime > timeout) break;
        }
        if (Date.now() - startTime > timeout) break;
      }

      // Deep scan for hidden CAPTCHAs
      if (deepScan) {
        const hiddenCaptchas = await this.deepScan();
        captchas.push(...hiddenCaptchas);
      }

      // Check iframes for CAPTCHAs
      if (checkIframes) {
        const iframeCaptchas = await this.scanIframes();
        captchas.push(...iframeCaptchas);
      }

      // Check for CAPTCHA-related scripts
      const scriptCaptchas = await this.detectByScripts();
      captchas.push(...scriptCaptchas);

      // Deduplicate and sort by confidence
      const uniqueCaptchas = this.deduplicateCaptchas(captchas);
      uniqueCaptchas.sort((a, b) => b.confidence - a.confidence);

      return formatResponse({
        success: true,
        action: 'detectCaptcha',
        timestamp: Date.now(),
        value: {
          detected: uniqueCaptchas.length > 0,
          count: uniqueCaptchas.length,
          captchas: uniqueCaptchas,
          requiresIntervention: uniqueCaptchas.some(c => c.interactive && c.visible)
        }
      });

    } catch (error) {
      return formatError(error as Error, 'Failed to detect CAPTCHAs');
    }
  }

  /**
   * Analyze a potential CAPTCHA element
   */
  private async analyzeCaptchaElement(element: ElementHandle, suggestedType: string): Promise<CaptchaInfo | null> {
    try {
      const info = await element.evaluate((el: Element, type) => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        
        const result: any = {
          type: type,
          visible: styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
          location: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          },
          attributes: {}
        };

        // Extract relevant attributes
        if (el.hasAttribute('data-sitekey')) {
          result.siteKey = el.getAttribute('data-sitekey');
        }
        if (el.hasAttribute('data-public-key')) {
          result.siteKey = el.getAttribute('data-public-key');
        }
        if (el.hasAttribute('data-hcaptcha-widget-id')) {
          result.widgetId = el.getAttribute('data-hcaptcha-widget-id');
        }
        
        // Check if it's an iframe
        if (el.tagName === 'IFRAME') {
          result.iframe = true;
          result.src = (el as any).src;
        }

        // Detect provider from classes and attributes
        const classNames = el.className || '';
        const id = el.id || '';
        
        if (classNames.includes('g-recaptcha') || id.includes('recaptcha')) {
          result.provider = 'google';
        } else if (classNames.includes('h-captcha') || id.includes('hcaptcha')) {
          result.provider = 'hcaptcha';
        } else if (classNames.includes('funcaptcha')) {
          result.provider = 'arkose';
        } else if (classNames.includes('geetest')) {
          result.provider = 'geetest';
        }

        return result;
      }, suggestedType);

      if (!info) return null;

      // Determine if interactive
      info.interactive = info.visible && (
        info.type === 'recaptcha-v2' ||
        info.type === 'hcaptcha' ||
        info.type === 'funcaptcha' ||
        info.type === 'image' ||
        info.type === 'puzzle'
      );

      // Set confidence based on detection method
      info.confidence = info.siteKey ? 0.9 : 0.7;

      return info as CaptchaInfo;

    } catch {
      return null;
    }
  }

  /**
   * Deep scan for hidden or dynamically loaded CAPTCHAs
   */
  private async deepScan(): Promise<CaptchaInfo[]> {
    try {
      const results = await this.page.evaluate(() => {
        const captchas: any[] = [];

        // Check for reCAPTCHA v3 (often invisible)
        if ((window as any).grecaptcha) {
          captchas.push({
            type: 'recaptcha-v3',
            provider: 'google',
            visible: false,
            interactive: false,
            confidence: 0.95
          });
        }

        // Check for hCaptcha global
        if ((window as any).hcaptcha) {
          captchas.push({
            type: 'hcaptcha',
            provider: 'hcaptcha',
            visible: false,
            interactive: true,
            confidence: 0.9
          });
        }

        // Check for FunCaptcha global
        if ((window as any).ArkoseEnforcement) {
          captchas.push({
            type: 'funcaptcha',
            provider: 'arkose',
            visible: false,
            interactive: true,
            confidence: 0.9
          });
        }

        // Check meta tags for CAPTCHA configuration
        const metaTags = document.querySelectorAll('meta');
        metaTags.forEach(meta => {
          const name = meta.getAttribute('name') || '';
          const content = meta.getAttribute('content') || '';
          
          if (name.includes('captcha') || content.includes('captcha')) {
            captchas.push({
              type: 'unknown',
              visible: false,
              interactive: false,
              attributes: { name, content },
              confidence: 0.5
            });
          }
        });

        return captchas;
      });

      return results;

    } catch {
      return [];
    }
  }

  /**
   * Scan iframes for CAPTCHAs
   */
  private async scanIframes(): Promise<CaptchaInfo[]> {
    try {
      const results = await this.page.evaluate(() => {
        const captchas: any[] = [];
        const iframes = document.querySelectorAll('iframe');

        iframes.forEach(iframe => {
          const src = iframe.src || '';
          
          // Check for CAPTCHA providers in iframe source
          if (src.includes('google.com/recaptcha')) {
            const rect = iframe.getBoundingClientRect();
            captchas.push({
              type: 'recaptcha-v2',
              provider: 'google',
              visible: rect.width > 0 && rect.height > 0,
              interactive: true,
              iframe: true,
              location: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
              },
              confidence: 0.95
            });
          } else if (src.includes('hcaptcha.com')) {
            const rect = iframe.getBoundingClientRect();
            captchas.push({
              type: 'hcaptcha',
              provider: 'hcaptcha',
              visible: rect.width > 0 && rect.height > 0,
              interactive: true,
              iframe: true,
              location: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
              },
              confidence: 0.95
            });
          } else if (src.includes('funcaptcha.com') || src.includes('arkoselabs.com')) {
            const rect = iframe.getBoundingClientRect();
            captchas.push({
              type: 'funcaptcha',
              provider: 'arkose',
              visible: rect.width > 0 && rect.height > 0,
              interactive: true,
              iframe: true,
              location: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
              },
              confidence: 0.95
            });
          }
        });

        return captchas;
      });

      return results;

    } catch {
      return [];
    }
  }

  /**
   * Detect CAPTCHAs by analyzing scripts
   */
  private async detectByScripts(): Promise<CaptchaInfo[]> {
    try {
      const results = await this.page.evaluate(() => {
        const captchas: any[] = [];
        const scripts = document.querySelectorAll('script');

        scripts.forEach(script => {
          const src = script.src || '';
          const content = script.textContent || '';
          
          // Check for CAPTCHA-related scripts
          if (src.includes('recaptcha') || content.includes('grecaptcha')) {
            captchas.push({
              type: src.includes('enterprise') ? 'recaptcha-v3' : 'recaptcha-v2',
              provider: 'google',
              visible: false,
              interactive: !src.includes('enterprise'),
              confidence: 0.8
            });
          } else if (src.includes('hcaptcha') || content.includes('hcaptcha')) {
            captchas.push({
              type: 'hcaptcha',
              provider: 'hcaptcha',
              visible: false,
              interactive: true,
              confidence: 0.8
            });
          } else if (src.includes('funcaptcha') || src.includes('arkoselabs')) {
            captchas.push({
              type: 'funcaptcha',
              provider: 'arkose',
              visible: false,
              interactive: true,
              confidence: 0.8
            });
          } else if (src.includes('geetest') || content.includes('geetest')) {
            captchas.push({
              type: 'geetest',
              provider: 'geetest',
              visible: false,
              interactive: true,
              confidence: 0.8
            });
          }
        });

        return captchas;
      });

      return results;

    } catch {
      return [];
    }
  }

  /**
   * Deduplicate detected CAPTCHAs
   */
  private deduplicateCaptchas(captchas: CaptchaInfo[]): CaptchaInfo[] {
    const unique = new Map<string, CaptchaInfo>();

    captchas.forEach(captcha => {
      const key = `${captcha.type}-${captcha.provider || 'unknown'}-${captcha.siteKey || 'none'}`;
      const existing = unique.get(key);
      
      if (!existing || captcha.confidence > existing.confidence) {
        unique.set(key, captcha);
      }
    });

    return Array.from(unique.values());
  }

  /**
   * Wait for CAPTCHA to be solved
   */
  async waitForSolution(options: {
    timeout?: number;
    checkInterval?: number;
  } = {}): Promise<ActionResult> {
    const { timeout = 120000, checkInterval = 1000 } = options;
    const startTime = Date.now();

    try {
      while (Date.now() - startTime < timeout) {
        // Check if CAPTCHA is still present
        const detection = await this.detect({ deepScan: false });
        
        if (!detection.success) {
          return detection;
        }

        const captchas = (detection as any).captchas as CaptchaInfo[];
        const visibleInteractive = captchas.filter(c => c.visible && c.interactive);

        if (visibleInteractive.length === 0) {
          // CAPTCHA solved or hidden
          return formatResponse({
            success: true,
            action: 'waitForCaptchaSolve',
            value: { solved: true, duration: Date.now() - startTime },
            timestamp: Date.now()
          });
        }

        // Check for success indicators
        const solved = await this.page.evaluate(() => {
          // Check for common success indicators
          const successSelectors = [
            '.recaptcha-success',
            '.captcha-success',
            '[data-captcha-solved="true"]',
            '.g-recaptcha-response:not(:empty)'
          ];

          for (const selector of successSelectors) {
            const element = document.querySelector(selector);
            if (element) return true;
          }

          // Check for reCAPTCHA response
          if ((window as any).grecaptcha) {
            try {
              const response = (window as any).grecaptcha.getResponse();
              if (response && response.length > 0) return true;
            } catch {}
          }

          return false;
        });

        if (solved) {
          return formatResponse({
            success: true,
            action: 'waitForCaptchaSolve',
            value: {
              solved: true,
              duration: Date.now() - startTime
            },
            timestamp: Date.now()
          });
        }

        await this.page.waitForTimeout(checkInterval);
      }

      return formatResponse({
        success: false,
        action: 'waitForCaptchaSolve',
        value: { solved: false, timeout: true, duration: timeout },
        timestamp: Date.now()
      });

    } catch (error) {
      return formatError(error as Error, 'Failed to wait for CAPTCHA solution');
    }
  }

  /**
   * Get CAPTCHA solving instructions
   */
  async getInstructions(): Promise<ActionResult> {
    try {
      const detection = await this.detect();
      
      if (!detection.success || !(detection as any).captchas?.length) {
        return formatResponse({
          success: true,
          action: 'getInstructions',
          value: {
            instructions: 'No CAPTCHA detected on this page.'
          },
          timestamp: Date.now()
        });
      }

      const captchas = (detection as any).captchas as CaptchaInfo[];
      const primary = captchas[0];

      let instructions = '';

      switch (primary.type) {
        case 'recaptcha-v2':
          instructions = 'Google reCAPTCHA v2 detected. Click the checkbox and solve the image challenges if presented.';
          break;
        case 'recaptcha-v3':
          instructions = 'Google reCAPTCHA v3 detected. This runs invisibly in the background. No user action required.';
          break;
        case 'hcaptcha':
          instructions = 'hCaptcha detected. Click the checkbox and solve the image challenges when presented.';
          break;
        case 'funcaptcha':
          instructions = 'FunCaptcha detected. Complete the interactive puzzle or game when presented.';
          break;
        case 'geetest':
          instructions = 'GeeTest CAPTCHA detected. Complete the slider puzzle or verification challenge.';
          break;
        case 'text':
          instructions = 'Text CAPTCHA detected. Enter the characters shown in the image into the text field.';
          break;
        case 'image':
          instructions = 'Image CAPTCHA detected. Select all images matching the given description.';
          break;
        case 'puzzle':
          instructions = 'Puzzle CAPTCHA detected. Complete the puzzle by dragging pieces to the correct position.';
          break;
        case 'math':
          instructions = 'Math CAPTCHA detected. Solve the mathematical equation and enter the answer.';
          break;
        default:
          instructions = 'Unknown CAPTCHA type detected. Manual solving may be required.';
      }

      if (primary.visible && primary.interactive) {
        instructions += ' User interaction is required to proceed.';
      }

      if (primary.location) {
        instructions += ` CAPTCHA is located at coordinates (${Math.round(primary.location.x)}, ${Math.round(primary.location.y)}).`;
      }

      return formatResponse({
        success: true,
        action: 'getInstructions',
        value: {
          type: primary.type,
          provider: primary.provider,
          instructions,
          requiresIntervention: primary.visible && primary.interactive,
          location: primary.location
        },
        timestamp: Date.now()
      });

    } catch (error) {
      return formatError(error as Error, 'Failed to get CAPTCHA instructions');
    }
  }
}