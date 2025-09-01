/**
 * FileUploadManager - Advanced file upload handling with drag-and-drop support
 */

import { Page } from 'playwright-core';
import { ElementLocator } from '../selectors/ElementLocator';
import { ActionResult, ElementSelector } from '../types';
import { formatSuccess, formatError } from '../utils/responseFormatter';
import * as fs from 'fs';
import * as path from 'path';

export interface FileUploadOptions {
  /** Method to use for upload */
  method?: 'input' | 'dragDrop' | 'auto';
  /** Whether to validate file exists before upload */
  validateFile?: boolean;
  /** Maximum file size in bytes (optional) */
  maxFileSize?: number;
  /** Allowed file extensions (optional) */
  allowedExtensions?: string[];
  /** Custom drag event data */
  dragData?: Record<string, any>;
  /** Timeout for the operation */
  timeout?: number;
}

export interface DragDropUploadResult extends ActionResult {
  data?: {
    files: string[];
    method: 'input' | 'dragDrop';
    totalSize: number;
    uploadTime: number;
  };
}

export class FileUploadManager {
  private elementLocator: ElementLocator;
  private defaultTimeout: number = 10000;

  constructor(elementLocator: ElementLocator) {
    this.elementLocator = elementLocator;
  }

  /**
   * Upload files using the most appropriate method
   */
  async uploadFiles(
    page: Page,
    selector: string | ElementSelector,
    filePaths: string | string[],
    options: FileUploadOptions = {}
  ): Promise<DragDropUploadResult> {
    const startTime = Date.now();
    const files = Array.isArray(filePaths) ? filePaths : [filePaths];
    
    try {
      // Validate files if requested
      if (options.validateFile !== false) {
        const validation = await this.validateFiles(files, options);
        if (!validation.success) {
          return formatError(validation.error!, 'uploadFiles');
        }
      }

      // Determine upload method
      const method = options.method || 'auto';
      
      if (method === 'dragDrop') {
        return await this.uploadViaDragDrop(page, selector, files, options, startTime);
      } else if (method === 'input') {
        return await this.uploadViaInput(page, selector, files, options, startTime);
      } else {
        // Auto mode: try input first, fall back to drag-drop
        const inputResult = await this.uploadViaInput(page, selector, files, options, startTime);
        if (inputResult.success) {
          return inputResult;
        }
        return await this.uploadViaDragDrop(page, selector, files, options, startTime);
      }
    } catch (error) {
      return formatError(`File upload failed: ${(error as Error).message}`, 'uploadFiles');
    }
  }

  /**
   * Upload files via standard input element
   */
  private async uploadViaInput(
    page: Page,
    selector: string | ElementSelector,
    files: string[],
    options: FileUploadOptions,
    startTime: number
  ): Promise<DragDropUploadResult> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: options.timeout || this.defaultTimeout,
      });

      if (!element) {
        return formatError(`Upload element not found: ${this.selectorToString(selector)}`, 'uploadViaInput');
      }

      // Check if it's an input element and upload
      try {
        // Try to upload directly to the located element
        await element.setInputFiles(files);
      } catch (error) {
        // If it's not an input element, try to find one nearby
        try {
          // Try to find a file input associated with this element
          const fileInput = await page.locator('input[type="file"]').first();
          await fileInput.setInputFiles(files);
        } catch (innerError) {
          return formatError('Could not find file input element', 'uploadViaInput');
        }
      }

      const totalSize = await this.getTotalFileSize(files);
      
      return formatSuccess('uploadFiles', {
        files: files.map(f => path.basename(f)),
        method: 'input',
        totalSize,
        uploadTime: Date.now() - startTime,
      });
    } catch (error) {
      return formatError(`Input upload failed: ${(error as Error).message}`, 'uploadViaInput');
    }
  }

  /**
   * Upload files via drag and drop
   */
  private async uploadViaDragDrop(
    page: Page,
    selector: string | ElementSelector,
    files: string[],
    options: FileUploadOptions,
    startTime: number
  ): Promise<DragDropUploadResult> {
    try {
      const dropZone = await this.elementLocator.locateWithWait(page, selector, {
        timeout: options.timeout || this.defaultTimeout,
        waitForStable: true,
      });

      if (!dropZone) {
        return formatError(`Drop zone not found: ${this.selectorToString(selector)}`, 'uploadViaDragDrop');
      }

      // Create data transfer with files
      await this.createDataTransfer(page, files, options.dragData);

      // Get drop zone position
      const box = await dropZone.boundingBox();
      if (!box) {
        return formatError('Could not determine drop zone position', 'uploadViaDragDrop');
      }

      // Simulate drag and drop events
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      // Trigger dragenter event
      await page.mouse.move(centerX, centerY);
      await page.evaluate(({ x, y }) => {
        const event = new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });
        const element = document.elementFromPoint(x, y);
        element?.dispatchEvent(event);
      }, { x: centerX, y: centerY });

      // Trigger dragover event
      await page.evaluate(({ x, y }) => {
        const event = new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });
        const element = document.elementFromPoint(x, y);
        element?.dispatchEvent(event);
      }, { x: centerX, y: centerY });

      // Trigger drop event with files
      await page.evaluate(({ x, y, files }) => {
        const dt = new DataTransfer();
        
        // Create File objects from file data
        files.forEach((fileData: any) => {
          const file = new File([fileData.content], fileData.name, { 
            type: fileData.type || 'application/octet-stream' 
          });
          dt.items.add(file);
        });

        const event = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          dataTransfer: dt,
        });
        
        const element = document.elementFromPoint(x, y);
        if (element) {
          element.dispatchEvent(event);
        }
      }, { 
        x: centerX, 
        y: centerY, 
        files: await this.prepareFilesForDrop(files)
      });

      // Trigger dragleave event
      await page.evaluate(({ x, y }) => {
        const event = new DragEvent('dragleave', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
        });
        const element = document.elementFromPoint(x, y);
        element?.dispatchEvent(event);
      }, { x: centerX, y: centerY });

      const totalSize = await this.getTotalFileSize(files);

      return formatSuccess('uploadFiles', {
        files: files.map(f => path.basename(f)),
        method: 'dragDrop',
        totalSize,
        uploadTime: Date.now() - startTime,
      });
    } catch (error) {
      return formatError(`Drag-drop upload failed: ${(error as Error).message}`, 'uploadViaDragDrop');
    }
  }

  /**
   * Prepare files for drag and drop
   */
  private async prepareFilesForDrop(filePaths: string[]): Promise<any[]> {
    const files = [];
    for (const filePath of filePaths) {
      const content = await fs.promises.readFile(filePath);
      const name = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      // Determine MIME type
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.zip': 'application/zip',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      
      files.push({
        name,
        content: content.toString('base64'),
        type: mimeTypes[ext] || 'application/octet-stream',
      });
    }
    return files;
  }

  /**
   * Create a DataTransfer object for drag and drop
   */
  private async createDataTransfer(page: Page, _files: string[], customData?: Record<string, any>): Promise<any> {
    return await page.evaluateHandle((customData) => {
      const dt = new DataTransfer();
      
      // Add custom data if provided
      if (customData) {
        Object.entries(customData).forEach(([key, value]) => {
          dt.setData(key, String(value));
        });
      }
      
      // Add common drag data
      dt.effectAllowed = 'all';
      dt.dropEffect = 'copy';
      
      return dt;
    }, customData);
  }


  /**
   * Validate files before upload
   */
  private async validateFiles(
    files: string[],
    options: FileUploadOptions
  ): Promise<{ success: boolean; error?: string }> {
    for (const file of files) {
      // Check if file exists
      if (!fs.existsSync(file)) {
        return { success: false, error: `File not found: ${file}` };
      }

      const stats = await fs.promises.stat(file);

      // Check file size
      if (options.maxFileSize && stats.size > options.maxFileSize) {
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const maxMB = (options.maxFileSize / (1024 * 1024)).toFixed(2);
        return { 
          success: false, 
          error: `File ${path.basename(file)} is too large (${sizeMB}MB > ${maxMB}MB)` 
        };
      }

      // Check file extension
      if (options.allowedExtensions && options.allowedExtensions.length > 0) {
        const ext = path.extname(file).toLowerCase();
        if (!options.allowedExtensions.includes(ext)) {
          return { 
            success: false, 
            error: `File type ${ext} not allowed. Allowed types: ${options.allowedExtensions.join(', ')}` 
          };
        }
      }
    }

    return { success: true };
  }

  /**
   * Get total size of files
   */
  private async getTotalFileSize(files: string[]): Promise<number> {
    let total = 0;
    for (const file of files) {
      try {
        const stats = await fs.promises.stat(file);
        total += stats.size;
      } catch {
        // Ignore files that can't be accessed
      }
    }
    return total;
  }

  /**
   * Convert selector to string for error messages
   */
  private selectorToString(selector: string | ElementSelector): string {
    if (typeof selector === 'string') {
      return selector;
    }
    return (selector as any).description || (selector as any).selector || 'complex selector';
  }

  /**
   * Simulate file drop from system
   */
  async simulateFileDrop(
    page: Page,
    selector: string | ElementSelector,
    filePaths: string | string[],
    options: FileUploadOptions = {}
  ): Promise<DragDropUploadResult> {
    return await this.uploadFiles(page, selector, filePaths, { 
      ...options, 
      method: 'dragDrop' 
    });
  }

  /**
   * Check if an element supports drag and drop upload
   */
  async supportsDragDrop(page: Page, selector: string | ElementSelector): Promise<boolean> {
    try {
      const element = await this.elementLocator.locateWithWait(page, selector, {
        timeout: this.defaultTimeout,
      });

      if (!element) {
        return false;
      }

      // Check for drag and drop event listeners or attributes
      return await element.evaluate((el) => {
        // Check for common drag-drop attributes
        if (el.hasAttribute('droppable') || 
            el.hasAttribute('data-drop-zone') ||
            el.classList.contains('drop-zone') ||
            el.classList.contains('dropzone') ||
            el.classList.contains('drag-drop')) {
          return true;
        }

        // Check for drag event listeners
        const hasListener = (eventType: string): boolean => {
          const listeners = (el as any).getEventListeners?.(el);
          return listeners && listeners[eventType] && listeners[eventType].length > 0;
        };

        return hasListener('drop') || hasListener('dragover') || hasListener('dragenter');
      });
    } catch {
      return false;
    }
  }
}