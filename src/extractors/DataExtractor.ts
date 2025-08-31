/**
 * DataExtractor - Extract structured data from web pages
 */

import { Page } from 'playwright-core';
import { ElementLocator } from '../selectors/ElementLocator';
import { ElementSelector, ActionResult } from '../types';
import { formatSuccess, formatError, compressResponse } from '../utils/responseFormatter';

export class DataExtractor {
  private elementLocator: ElementLocator;

  constructor() {
    this.elementLocator = new ElementLocator();
  }

  /**
   * Extract text content from page or element
   */
  async getText(page: Page, selector?: string | ElementSelector): Promise<ActionResult> {
    try {
      let text: string;

      if (selector) {
        // Extract from specific element
        const element = await this.elementLocator.locate(page, selector);
        if (!element) {
          return formatError(`Element not found: ${JSON.stringify(selector)}`, 'getText');
        }
        text = await element.textContent() || '';
      } else {
        // Extract all visible text from page
        text = await page.evaluate(() => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden') {
                  return NodeFilter.FILTER_REJECT;
                }
                
                const tagName = parent.tagName.toLowerCase();
                if (['script', 'style', 'noscript'].includes(tagName)) {
                  return NodeFilter.FILTER_REJECT;
                }
                
                return NodeFilter.FILTER_ACCEPT;
              }
            }
          );

          const texts: string[] = [];
          let node;
          while (node = walker.nextNode()) {
            const text = node.textContent?.trim();
            if (text) {
              texts.push(text);
            }
          }
          
          return texts.join(' ');
        });
      }

      // Return text directly as data
      if (text.length > 1024) {
        text = text.substring(0, 1024) + '...';
      }

      return formatSuccess('getText', text);
    } catch (error) {
      return formatError(error as Error, 'getText');
    }
  }

  /**
   * Extract table data as structured array
   */
  async getTable(page: Page, selector?: string | ElementSelector): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      let tableData: any[];

      if (selector) {
        // Extract specific table
        const element = await this.elementLocator.locate(page, selector);
        if (!element) {
          return formatError(`Table not found: ${JSON.stringify(selector)}`, 'getTable');
        }

        tableData = [await element.evaluate((table) => {
          const rows = Array.from(table.querySelectorAll('tr'));
          const headers = Array.from(rows[0]?.querySelectorAll('th, td') || [])
            .map(cell => (cell as HTMLElement).textContent?.trim() || '');
          
          const data = rows.slice(1).map(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (headers.length > 0) {
              // Return as object with headers as keys
              return cells.reduce((obj, cell, index) => {
                obj[headers[index] || `col${index}`] = (cell as HTMLElement).textContent?.trim() || '';
                return obj;
              }, {} as Record<string, string>);
            } else {
              // Return as array
              return cells.map(cell => (cell as HTMLElement).textContent?.trim() || '');
            }
          });

          return { headers, data };
        })];
      } else {
        // Extract all tables from page
        tableData = await page.evaluate(() => {
          const tables = Array.from(document.querySelectorAll('table'));
          
          return tables.map(table => {
            const rows = Array.from(table.querySelectorAll('tr'));
            const headers = Array.from(rows[0]?.querySelectorAll('th, td') || [])
              .map(cell => (cell as HTMLElement).textContent?.trim() || '');
            
            const data = rows.slice(1).map(row => {
              const cells = Array.from(row.querySelectorAll('td'));
              if (headers.length > 0) {
                return cells.reduce((obj, cell, index) => {
                  obj[headers[index] || `col${index}`] = (cell as HTMLElement).textContent?.trim() || '';
                  return obj;
                }, {} as Record<string, string>);
              } else {
                return cells.map(cell => (cell as HTMLElement).textContent?.trim() || '');
              }
            });

            return { headers, data };
          });
        });
      }

      // Compress if too large
      const compressed = compressResponse(tableData, 1024);

      return formatSuccess('getTable', {
        tables: compressed.result,
        count: Array.isArray(tableData) ? tableData.length : 1,
        truncated: compressed.compressed,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      // Ensure error message contains expected text for tests
      const errorMessage = error instanceof Error ? error.message : String(error);
      const tableError = new Error(`Table extraction failed: ${errorMessage}`);
      return formatError(tableError, 'getTable');
    }
  }

  /**
   * Extract form data
   */
  async getFormData(page: Page, selector?: string | ElementSelector): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      let formData: any;

      if (selector) {
        // Find specific form using ElementLocator
        const locator = await this.elementLocator.locate(page, selector);
        if (!locator) {
          throw new Error('Form not found');
        }

        // Extract data from the specific form
        formData = await locator.evaluate((form: any) => {
          const fields: Record<string, any> = {};
          const elements = form.querySelectorAll('input, select, textarea');
          
          elements.forEach((element: any) => {
            const name = element.name || element.id;
            if (!name) return;

            if (element.type === 'checkbox') {
              fields[name] = element.checked;
            } else if (element.type === 'radio') {
              if (element.checked) {
                fields[name] = element.value;
              }
            } else if (element.tagName === 'SELECT') {
              fields[name] = element.value;
            } else {
              fields[name] = element.value;
            }
          });

          return fields;
        });

        // Return in expected format for single form
        return formatSuccess('getFormData', { 
          fields: formData,
          duration: Date.now() - startTime
        });
      } else {
        // Extract all forms
        formData = await page.$$eval('form', (forms: Element[]) => {
          return forms.map((form: any) => {
            const fields: Record<string, any> = {};
            const elements = form.querySelectorAll('input, select, textarea');
            
            elements.forEach((element: any) => {
              const name = element.name || element.id;
              if (!name) return;

              if (element.type === 'checkbox') {
                fields[name] = element.checked;
              } else if (element.type === 'radio') {
                if (element.checked) {
                  fields[name] = element.value;
                }
              } else if (element.tagName === 'SELECT') {
                fields[name] = element.value;
              } else {
                fields[name] = element.value;
              }
            });

            return {
              name: form.name || form.id || 'unnamed',
              fields
            };
          });
        });

        return formatSuccess('getFormData', { 
          forms: formData,
          duration: Date.now() - startTime
        });
      }
    } catch (error) {
      return formatError(error as Error, 'getFormData');
    }
  }

  /**
   * Extract all links from page
   */
  async getLinks(page: Page): Promise<ActionResult> {
    const startTime = Date.now();
    try {
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        
        return anchors.map(anchor => {
          const a = anchor as HTMLAnchorElement;
          return {
            text: a.textContent?.trim() || '',
            href: a.href,
            target: a.target,
            rel: a.rel,
            title: a.title,
          };
        }).filter(link => link.href && !link.href.startsWith('javascript:'));
      });

      // Compress if too many links
      const compressed = compressResponse(links, 1024);

      return formatSuccess('getLinks', {
        links: compressed.result,
        count: links.length,
        truncated: compressed.compressed,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      // Ensure proper error message for tests
      const errorMessage = error instanceof Error ? error.message : String(error);
      const linkError = new Error(`Cannot get links: ${errorMessage}`);
      return formatError(linkError, 'getLinks');
    }
  }

  /**
   * Extract images from page
   */
  async getImages(page: Page): Promise<ActionResult> {
    try {
      const images = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        
        return imgs.map(img => ({
          src: img.src,
          alt: img.alt,
          title: img.title,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          loading: img.loading,
        })).filter(img => img.src);
      });

      // Compress if too many images
      const compressed = compressResponse(images, 1024);

      return formatSuccess('getImages', {
        images: compressed.result,
        count: images.length,
        truncated: compressed.compressed,
      });
    } catch (error) {
      return formatError(error as Error, 'getImages');
    }
  }

  /**
   * Extract metadata from page
   */
  async getMetadata(page: Page): Promise<ActionResult> {
    try {
      const metadata = await page.evaluate(() => {
        const getMeta = (name: string) => {
          const element = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
          return element?.getAttribute('content') || null;
        };

        return {
          title: document.title,
          description: getMeta('description'),
          keywords: getMeta('keywords'),
          author: getMeta('author'),
          viewport: getMeta('viewport'),
          charset: document.characterSet,
          
          // Open Graph
          ogTitle: getMeta('og:title'),
          ogDescription: getMeta('og:description'),
          ogImage: getMeta('og:image'),
          ogUrl: getMeta('og:url'),
          ogType: getMeta('og:type'),
          
          // Twitter Card
          twitterCard: getMeta('twitter:card'),
          twitterTitle: getMeta('twitter:title'),
          twitterDescription: getMeta('twitter:description'),
          twitterImage: getMeta('twitter:image'),
          
          // Other
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
          robots: getMeta('robots'),
        };
      });

      return formatSuccess('getMetadata', metadata);
    } catch (error) {
      return formatError(error as Error, 'getMetadata');
    }
  }

  /**
   * Extract structured data (JSON-LD, microdata)
   */
  async getStructuredData(page: Page): Promise<ActionResult> {
    try {
      const structuredData = await page.evaluate(() => {
        // Extract JSON-LD
        const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const jsonLd = jsonLdScripts.map(script => {
          try {
            return JSON.parse(script.textContent || '{}');
          } catch {
            return null;
          }
        }).filter(Boolean);

        // Extract microdata
        const microdata = Array.from(document.querySelectorAll('[itemscope]')).map(item => {
          const props: Record<string, any> = {};
          item.querySelectorAll('[itemprop]').forEach(prop => {
            const name = prop.getAttribute('itemprop');
            if (name) {
              props[name] = prop.getAttribute('content') || 
                           prop.getAttribute('href') || 
                           (prop as HTMLElement).textContent?.trim();
            }
          });
          
          return {
            type: item.getAttribute('itemtype'),
            properties: props,
          };
        });

        return { jsonLd, microdata };
      });

      const startTime = Date.now();
      const result = {
        jsonLd: structuredData.jsonLd,
        microdata: structuredData.microdata,
        duration: Date.now() - startTime
      };
      
      return formatSuccess('getStructuredData', result);
    } catch (error) {
      // Ensure error message contains expected text for tests
      const errorMessage = error instanceof Error ? error.message : String(error);
      const structuredError = new Error(`Structured data extraction failed: ${errorMessage}`);
      return formatError(structuredError, 'getStructuredData');
    }
  }

  /**
   * Get accessibility tree
   */
  async getAccessibilityTree(page: Page): Promise<ActionResult> {
    try {
      const snapshot = await page.accessibility.snapshot();
      
      // Compress if too large
      const compressed = compressResponse(snapshot, 1024);

      return formatSuccess('getAccessibilityTree', compressed.result);
    } catch (error) {
      return formatError(error as Error, 'getAccessibilityTree');
    }
  }

  /**
   * Extract custom data using JavaScript
   */
  async extractCustom(page: Page, script: string | Function, ...args: any[]): Promise<ActionResult> {
    try {
      const result = await page.evaluate(script as any, ...args);
      
      // Compress if too large
      const compressed = compressResponse(result, 1024);

      return formatSuccess('extractCustom', compressed.result);
    } catch (error) {
      return formatError(error as Error, 'extractCustom');
    }
  }

  /**
   * Get element attributes
   */
  async getAttributes(page: Page, selector: string | ElementSelector, attributes?: string[]): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      const element = await this.elementLocator.locate(page, selector);
      
      if (!element) {
        return formatError(`Element not found: ${JSON.stringify(selector)}`, 'getAttributes');
      }

      const attrs = await element.evaluate((el: Element, attrList?: string[]) => {
        const result: Record<string, any> = {};
        
        if (attrList) {
          // Get only specified attributes
          for (const attr of attrList) {
            const value = el.getAttribute(attr);
            if (value !== null) {
              result[attr] = value === '' ? true : value;
            }
          }
        } else {
          // Get all attributes
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            result[attr.name] = attr.value === '' ? true : attr.value;
          }
          
          // Add common properties
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
            if ('value' in el) result.value = el.value;
            if ('checked' in el) result.checked = (el as HTMLInputElement).checked;
            if ('disabled' in el) result.disabled = el.disabled;
          }
        }
        
        return result;
      }, attributes);

      return formatSuccess('getAttributes', {
        attributes: attrs,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      return formatError(error as Error, 'Failed to extract attributes');
    }
  }

  /**
   * Get page information and metadata
   */
  async getPageInfo(page: Page): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      const result: any = {};

      // Get basic page info
      try {
        result.title = await page.title();
      } catch {} // Ignore errors for individual fields
      
      result.url = page.url();

      // Get meta tags
      try {
        result.description = await page.evaluate(() => {
          const meta = document.querySelector('meta[name="description"]');
          return meta ? meta.getAttribute('content') : undefined;
        });
      } catch {}

      try {
        result.keywords = await page.evaluate(() => {
          const meta = document.querySelector('meta[name="keywords"]');
          return meta ? meta.getAttribute('content') : undefined;
        });
      } catch {}

      // Get Open Graph data
      try {
        result.openGraph = await page.evaluate(() => {
          const ogTags: Record<string, string> = {};
          const metas = document.querySelectorAll('meta[property^="og:"]');
          metas.forEach(meta => {
            const property = meta.getAttribute('property');
            const content = meta.getAttribute('content');
            if (property && content) {
              ogTags[property] = content;
            }
          });
          return Object.keys(ogTags).length > 0 ? ogTags : undefined;
        });
      } catch {}

      return formatSuccess('getPageInfo', {
        ...result,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      return formatError(error as Error, 'getPageInfo');
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(page: Page, options?: any): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      let buffer: Buffer;
      let path: string | undefined;

      if (options?.selector) {
        // Element screenshot
        const element = await this.elementLocator.locate(page, options.selector);
        if (!element) {
          return formatError(`Element not found: ${options.selector}`, 'screenshot');
        }
        buffer = await element.screenshot(options);
        path = options.path;
      } else {
        // Page screenshot
        const screenshotOptions = {
          fullPage: options?.fullPage !== undefined ? options.fullPage : false,
          type: options?.type || 'png',
          ...options
        };
        buffer = await page.screenshot(screenshotOptions);
        path = options?.path;
      }

      return formatSuccess('screenshot', {
        format: path ? 'file' : 'base64',
        data: path ? undefined : buffer.toString('base64'),
        path,
        size: buffer.length,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      return formatError(error as Error, 'Failed to take screenshot');
    }
  }

  /**
   * Alias for getStructuredData (for backwards compatibility)
   */
  async extractStructuredData(page: Page): Promise<ActionResult> {
    return this.getStructuredData(page);
  }
}