/**
 * PDF Generation from web pages
 */

import { Page } from 'playwright-core';

// Define PDFOptions type locally since it's not exported from playwright-core
interface PDFOptions {
  path?: string;
  scale?: number;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
  landscape?: boolean;
  pageRanges?: string;
  format?: string;
  width?: string | number;
  height?: string | number;
  margin?: {
    top?: string | number;
    right?: string | number;
    bottom?: string | number;
    left?: string | number;
  };
  preferCSSPageSize?: boolean;
  outline?: boolean;
  tagged?: boolean;
}

export interface PdfGenerationOptions {
  // Page setup
  format?: 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
  width?: string | number;  // e.g., '8.5in', '21cm', 816 (pixels)
  height?: string | number; // e.g., '11in', '29.7cm', 1056 (pixels)
  landscape?: boolean;
  
  // Margins
  margin?: {
    top?: string | number;
    right?: string | number;
    bottom?: string | number;
    left?: string | number;
  };
  
  // Content options
  displayHeaderFooter?: boolean;
  headerTemplate?: string;  // HTML template for header
  footerTemplate?: string;  // HTML template for footer
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
  
  // Page range
  pageRanges?: string;  // e.g., '1-5, 8, 11-13'
  
  // Output options
  scale?: number;  // Scale of the webpage rendering (0.1 to 2)
  outline?: boolean; // Generate document outline/bookmarks
  tagged?: boolean;  // Generate tagged (accessible) PDF
}

export interface PdfResult {
  success: boolean;
  buffer?: Buffer;
  size?: number;
  pages?: number;
  error?: string;
  metadata?: {
    title?: string;
    url?: string;
    generatedAt?: string;
    options?: PdfGenerationOptions;
  };
}

export interface PdfSaveResult {
  success: boolean;
  path?: string;
  size?: number;
  error?: string;
}

export class PdfGenerator {
  private page: Page | null = null;

  /**
   * Set the page instance
   */
  setPage(page: Page): void {
    this.page = page;
  }

  /**
   * Generate PDF from current page
   */
  async generatePdf(options: PdfGenerationOptions = {}): Promise<PdfResult> {
    try {
      if (!this.page) {
        return {
          success: false,
          error: 'No page available for PDF generation'
        };
      }

      // Get page metadata before generating PDF
      const metadata = await this.getPageMetadata();

      // Default options for high-quality PDF
      const defaultOptions: PDFOptions = {
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        scale: 1,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        }
      };

      // Merge with user options
      const pdfOptions: PDFOptions = {
        ...defaultOptions,
        ...this.convertToPdfOptions(options)
      };

      // Generate PDF
      const buffer = await this.page.pdf(pdfOptions);

      // Calculate approximate page count (rough estimate)
      const estimatedPages = this.estimatePageCount(buffer.length, options.format || 'A4');

      return {
        success: true,
        buffer,
        size: buffer.length,
        pages: estimatedPages,
        metadata: {
          ...metadata,
          generatedAt: new Date().toISOString(),
          options
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to generate PDF: ${errorMessage}`
      };
    }
  }

  /**
   * Generate PDF and save to file
   */
  async generateAndSavePdf(
    path: string,
    options: PdfGenerationOptions = {}
  ): Promise<PdfSaveResult> {
    try {
      if (!this.page) {
        return {
          success: false,
          error: 'No page available for PDF generation'
        };
      }

      // Convert options
      const pdfOptions = this.convertToPdfOptions(options);

      // Generate and save directly
      await this.page.pdf({
        path,
        ...pdfOptions
      });

      // Get file size
      const fs = await import('fs');
      const stats = await fs.promises.stat(path);

      return {
        success: true,
        path,
        size: stats.size
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to save PDF: ${errorMessage}`
      };
    }
  }

  /**
   * Generate PDF with custom header and footer
   */
  async generatePdfWithHeaderFooter(
    options: PdfGenerationOptions = {},
    headerHtml?: string,
    footerHtml?: string
  ): Promise<PdfResult> {
    const headerTemplate = headerHtml || `
      <div style="font-size: 10px; text-align: center; width: 100%;">
        <span class="title"></span>
      </div>
    `;

    const footerTemplate = footerHtml || `
      <div style="font-size: 10px; text-align: center; width: 100%;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>
    `;

    return this.generatePdf({
      ...options,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: options.margin || {
        top: '1in',
        bottom: '1in',
        left: '0.5in',
        right: '0.5in'
      }
    });
  }

  /**
   * Generate PDF of specific page element
   */
  async generateElementPdf(
    selector: string,
    options: PdfGenerationOptions = {}
  ): Promise<PdfResult> {
    try {
      if (!this.page) {
        return {
          success: false,
          error: 'No page available for PDF generation'
        };
      }

      // Hide all elements except the target
      await this.page.evaluate((sel) => {
        const target = document.querySelector(sel);
        if (!target) return;

        // Store original styles
        const originalStyles = new Map();
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach(el => {
          if (el !== target && !target.contains(el) && !el.contains(target)) {
            originalStyles.set(el, (el as HTMLElement).style.display);
            (el as HTMLElement).style.display = 'none';
          }
        });

        // Store styles for restoration
        (window as any).__pdfOriginalStyles = originalStyles;
      }, selector);

      // Generate PDF
      const result = await this.generatePdf(options);

      // Restore original styles
      await this.page.evaluate(() => {
        const originalStyles = (window as any).__pdfOriginalStyles;
        if (originalStyles) {
          originalStyles.forEach((display: string, el: HTMLElement) => {
            el.style.display = display || '';
          });
          delete (window as any).__pdfOriginalStyles;
        }
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to generate element PDF: ${errorMessage}`
      };
    }
  }

  /**
   * Generate PDF with table of contents
   */
  async generatePdfWithToc(options: PdfGenerationOptions = {}): Promise<PdfResult> {
    try {
      if (!this.page) {
        return {
          success: false,
          error: 'No page available for PDF generation'
        };
      }

      // Extract headings for TOC
      const headings = await this.page.evaluate(() => {
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        return Array.from(headingElements).map((h, index) => ({
          level: parseInt(h.tagName[1]),
          text: h.textContent?.trim() || '',
          id: `toc-${index}`
        }));
      });

      // Add IDs to headings for linking
      await this.page.evaluate((headingData) => {
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headingElements.forEach((h, index) => {
          h.id = headingData[index].id;
        });
      }, headings);

      // Create TOC HTML
      const tocHtml = this.generateTocHtml(headings);

      // Inject TOC at the beginning of the page
      await this.page.evaluate((html) => {
        const tocDiv = document.createElement('div');
        tocDiv.innerHTML = html;
        tocDiv.style.pageBreakAfter = 'always';
        document.body.insertBefore(tocDiv, document.body.firstChild);
      }, tocHtml);

      // Generate PDF with outline
      const result = await this.generatePdf({
        ...options,
        outline: true,
        tagged: true
      });

      // Remove TOC from page
      await this.page.evaluate(() => {
        const tocDiv = document.querySelector('div');
        if (tocDiv && tocDiv.innerHTML.includes('Table of Contents')) {
          tocDiv.remove();
        }
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to generate PDF with TOC: ${errorMessage}`
      };
    }
  }

  /**
   * Generate PDF optimized for printing
   */
  async generatePrintOptimizedPdf(options: PdfGenerationOptions = {}): Promise<PdfResult> {
    try {
      if (!this.page) {
        return {
          success: false,
          error: 'No page available for PDF generation'
        };
      }

      // Apply print styles
      await this.page.addStyleTag({
        content: `
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            /* Remove interactive elements */
            button, input, select, textarea {
              border: 1px solid #ccc !important;
              background: white !important;
            }
            
            /* Ensure links are visible */
            a[href]:after {
              content: " (" attr(href) ")";
              font-size: 0.8em;
              color: #666;
            }
            
            /* Page breaks */
            h1, h2, h3 {
              page-break-after: avoid;
            }
            
            img, figure {
              page-break-inside: avoid;
            }
            
            /* Remove animations */
            *, *::before, *::after {
              animation: none !important;
              transition: none !important;
            }
          }
        `
      });

      // Wait for styles to apply
      await this.page.waitForTimeout(100);

      // Generate PDF with print-optimized settings
      const result = await this.generatePdf({
        ...options,
        printBackground: true,
        preferCSSPageSize: true,
        format: options.format || 'Letter'
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to generate print-optimized PDF: ${errorMessage}`
      };
    }
  }

  /**
   * Convert options to Playwright PDF options
   */
  private convertToPdfOptions(options: PdfGenerationOptions): PDFOptions {
    const pdfOptions: PDFOptions = {};

    // Page setup
    if (options.format) pdfOptions.format = options.format;
    if (options.width) pdfOptions.width = options.width;
    if (options.height) pdfOptions.height = options.height;
    if (options.landscape !== undefined) pdfOptions.landscape = options.landscape;

    // Margins
    if (options.margin) pdfOptions.margin = options.margin;

    // Content options
    if (options.displayHeaderFooter !== undefined) {
      pdfOptions.displayHeaderFooter = options.displayHeaderFooter;
    }
    if (options.headerTemplate) pdfOptions.headerTemplate = options.headerTemplate;
    if (options.footerTemplate) pdfOptions.footerTemplate = options.footerTemplate;
    if (options.printBackground !== undefined) {
      pdfOptions.printBackground = options.printBackground;
    }
    if (options.preferCSSPageSize !== undefined) {
      pdfOptions.preferCSSPageSize = options.preferCSSPageSize;
    }

    // Page range
    if (options.pageRanges) pdfOptions.pageRanges = options.pageRanges;

    // Scale
    if (options.scale !== undefined) pdfOptions.scale = options.scale;

    // Outline and tagged
    if (options.outline !== undefined) pdfOptions.outline = options.outline;
    if (options.tagged !== undefined) pdfOptions.tagged = options.tagged;

    return pdfOptions;
  }

  /**
   * Get page metadata
   */
  private async getPageMetadata(): Promise<{ title?: string; url?: string }> {
    if (!this.page) return {};

    try {
      const [title, url] = await Promise.all([
        this.page.title(),
        this.page.url()
      ]);

      return { title, url };
    } catch {
      return {};
    }
  }

  /**
   * Estimate page count based on file size and format
   */
  private estimatePageCount(fileSize: number, format: string): number {
    // Rough estimates based on typical PDF sizes
    const bytesPerPage: Record<string, number> = {
      'A4': 50000,
      'Letter': 50000,
      'Legal': 60000,
      'Tabloid': 80000,
      'A3': 80000,
      'A5': 30000,
      'A6': 20000
    };

    const avgBytesPerPage = bytesPerPage[format] || 50000;
    return Math.max(1, Math.round(fileSize / avgBytesPerPage));
  }

  /**
   * Generate table of contents HTML
   */
  private generateTocHtml(headings: Array<{ level: number; text: string; id: string }>): string {
    let html = '<div class="toc"><h1>Table of Contents</h1><ul>';
    let currentLevel = 1;

    headings.forEach(heading => {
      // Adjust nesting level
      while (currentLevel < heading.level) {
        html += '<ul>';
        currentLevel++;
      }
      while (currentLevel > heading.level) {
        html += '</ul>';
        currentLevel--;
      }

      // Add TOC entry
      html += `<li><a href="#${heading.id}">${heading.text}</a></li>`;
    });

    // Close remaining lists
    while (currentLevel > 1) {
      html += '</ul>';
      currentLevel--;
    }

    html += '</ul></div>';
    
    // Add styles
    html = `
      <style>
        .toc { 
          padding: 20px; 
          font-family: Arial, sans-serif;
        }
        .toc h1 { 
          margin-bottom: 20px; 
        }
        .toc ul { 
          list-style-type: none; 
          padding-left: 20px; 
        }
        .toc li { 
          margin: 5px 0; 
        }
        .toc a { 
          text-decoration: none; 
          color: #333; 
        }
        .toc a:hover { 
          text-decoration: underline; 
        }
      </style>
      ${html}
    `;

    return html;
  }
}