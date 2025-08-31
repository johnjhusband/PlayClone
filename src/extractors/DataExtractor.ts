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
      const startTime = Date.now();
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

      // Compress if too large
      const compressed = compressResponse({ text }, 1024);

      return formatSuccess('getText', {
        ...compressed.result,
        length: text.length,
        truncated: compressed.compressed,
        duration: Date.now() - startTime,
      });
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
      return formatError(error as Error, 'getTable');
    }
  }

  /**
   * Extract form data
   */
  async getFormData(page: Page, selector?: string | ElementSelector): Promise<ActionResult> {
    try {
      const formData = await page.evaluate((formSelector) => {
        let forms: HTMLFormElement[];
        
        if (formSelector) {
          const form = document.querySelector(formSelector) as HTMLFormElement;
          forms = form ? [form] : [];
        } else {
          forms = Array.from(document.querySelectorAll('form'));
        }

        return forms.map(form => {
          const fields = Array.from(form.elements).map((element: any) => {
            const field: any = {
              name: element.name || element.id,
              type: element.type || element.tagName.toLowerCase(),
              value: element.value,
            };

            // Add additional properties based on type
            if (element.type === 'checkbox' || element.type === 'radio') {
              field.checked = element.checked;
            }
            
            if (element.tagName === 'SELECT') {
              field.options = Array.from(element.options).map((opt: any) => ({
                value: opt.value,
                text: opt.text,
                selected: opt.selected,
              }));
            }

            if (element.required) field.required = true;
            if (element.disabled) field.disabled = true;
            if (element.readOnly) field.readOnly = true;
            if (element.placeholder) field.placeholder = element.placeholder;

            return field;
          }).filter(field => field.name); // Filter out unnamed fields

          return {
            action: form.action,
            method: form.method,
            fields,
          };
        });
      }, selector ? (typeof selector === 'string' ? selector : selector.css || selector.xpath) : null);

      return formatSuccess('getFormData', { forms: formData });
    } catch (error) {
      return formatError(error as Error, 'getFormData');
    }
  }

  /**
   * Extract all links from page
   */
  async getLinks(page: Page): Promise<ActionResult> {
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

      // Group by internal/external
      const currentOrigin = new URL(page.url()).origin;
      const categorized = {
        internal: links.filter(link => {
          try {
            return new URL(link.href).origin === currentOrigin;
          } catch {
            return true; // Relative URLs are internal
          }
        }),
        external: links.filter(link => {
          try {
            return new URL(link.href).origin !== currentOrigin;
          } catch {
            return false;
          }
        }),
      };

      // Compress if too many links
      const compressed = compressResponse(categorized, 1024);

      return formatSuccess('getLinks', {
        ...compressed.result,
        total: links.length,
        truncated: compressed.compressed,
      });
    } catch (error) {
      return formatError(error as Error, 'getLinks');
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

      return formatSuccess('getStructuredData', structuredData);
    } catch (error) {
      return formatError(error as Error, 'getStructuredData');
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
}