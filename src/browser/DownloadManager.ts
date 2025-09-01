/**
 * DownloadManager - Handles file downloads with progress tracking
 */

import { Page, Download } from 'playwright-core';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export interface DownloadOptions {
  saveAs?: string;
  directory?: string;
  waitForComplete?: boolean;
  timeout?: number;
  trackProgress?: boolean;
}

export interface DownloadProgress {
  id: string;
  url: string;
  fileName: string;
  state: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  totalBytes: number;
  receivedBytes: number;
  progress: number;
  speed: number;
  remainingTime: number;
  savePath?: string;
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface DownloadResult {
  success: boolean;
  downloadId?: string;
  fileName?: string;
  savePath?: string;
  size?: number;
  mimeType?: string;
  error?: string;
  data?: string;
}

/**
 * Manages browser downloads with progress tracking
 */
export class DownloadManager extends EventEmitter {
  private downloads: Map<string, DownloadProgress> = new Map();
  private page: Page;
  private downloadDir: string;
  private activeDownloads: Set<string> = new Set();

  constructor(page: Page, downloadDir?: string) {
    super();
    this.page = page;
    this.downloadDir = downloadDir || path.join(process.cwd(), 'downloads');
    this.ensureDownloadDir();
    this.setupDownloadHandler();
  }

  /**
   * Ensure download directory exists
   */
  private ensureDownloadDir(): void {
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  /**
   * Set up download event handler
   */
  private setupDownloadHandler(): void {
    this.page.on('download', async (download: Download) => {
      const downloadId = this.generateDownloadId();
      const fileName = download.suggestedFilename();
      
      const progress: DownloadProgress = {
        id: downloadId,
        url: download.url(),
        fileName,
        state: 'downloading',
        totalBytes: 0,
        receivedBytes: 0,
        progress: 0,
        speed: 0,
        remainingTime: 0,
        startTime: Date.now()
      };

      this.downloads.set(downloadId, progress);
      this.activeDownloads.add(downloadId);
      this.emit('downloadStarted', progress);

      // Track progress if possible
      this.trackDownloadProgress(download, downloadId);
    });
  }

  /**
   * Track download progress
   */
  private async trackDownloadProgress(download: Download, downloadId: string): Promise<void> {
    const progress = this.downloads.get(downloadId);
    if (!progress) return;

    try {
      // Save the download
      const savePath = path.join(this.downloadDir, progress.fileName);
      await download.saveAs(savePath);

      // Get file size after download
      const stats = fs.statSync(savePath);
      
      progress.state = 'completed';
      progress.savePath = savePath;
      progress.totalBytes = stats.size;
      progress.receivedBytes = stats.size;
      progress.progress = 100;
      progress.endTime = Date.now();
      
      this.activeDownloads.delete(downloadId);
      this.emit('downloadCompleted', progress);
    } catch (error) {
      progress.state = 'failed';
      progress.error = error instanceof Error ? error.message : 'Download failed';
      progress.endTime = Date.now();
      
      this.activeDownloads.delete(downloadId);
      this.emit('downloadFailed', progress);
    }
  }

  /**
   * Trigger a download by clicking an element or navigating to URL
   */
  async triggerDownload(
    urlOrSelector: string,
    options: DownloadOptions = {}
  ): Promise<DownloadResult> {
    try {
      const {
        saveAs,
        directory = this.downloadDir,
        timeout = 30000,
        trackProgress = true
      } = options;

      // Set download directory for this session
      if (directory !== this.downloadDir) {
        this.downloadDir = directory;
        this.ensureDownloadDir();
      }

      let download: Download;

      // Check if it's a URL or selector
      if (urlOrSelector.startsWith('http://') || urlOrSelector.startsWith('https://')) {
        // For direct file URLs, use page.evaluate to force download
        const response = await this.page.evaluate(async (url) => {
          const link = document.createElement('a');
          link.href = url;
          link.download = url.split('/').pop() || 'download';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return true;
        }, urlOrSelector);

        if (!response) {
          throw new Error('Failed to trigger download');
        }

        // Wait for download event
        download = await this.page.waitForEvent('download', { timeout });
      } else {
        // Create download promise before clicking
        const downloadPromise = this.page.waitForEvent('download', { timeout });
        
        // Click element to trigger download
        await this.page.click(urlOrSelector);
        
        // Wait for download to start
        download = await downloadPromise;
      }
      const downloadId = this.generateDownloadId();
      const fileName = saveAs || download.suggestedFilename();
      const savePath = path.join(directory, fileName);

      // Create progress tracking
      if (trackProgress) {
        const progress: DownloadProgress = {
          id: downloadId,
          url: download.url(),
          fileName,
          state: 'downloading',
          totalBytes: 0,
          receivedBytes: 0,
          progress: 0,
          speed: 0,
          remainingTime: 0,
          startTime: Date.now(),
          savePath
        };

        this.downloads.set(downloadId, progress);
        this.activeDownloads.add(downloadId);
        this.emit('downloadStarted', progress);
      }

      // Save the download
      await download.saveAs(savePath);

      // Get file info
      const stats = fs.statSync(savePath);

      // Update progress if tracking
      if (trackProgress) {
        const progress = this.downloads.get(downloadId);
        if (progress) {
          progress.state = 'completed';
          progress.totalBytes = stats.size;
          progress.receivedBytes = stats.size;
          progress.progress = 100;
          progress.endTime = Date.now();
          this.activeDownloads.delete(downloadId);
          this.emit('downloadCompleted', progress);
        }
      }

      return {
        success: true,
        downloadId,
        fileName,
        savePath,
        size: stats.size,
        mimeType: this.getMimeType(fileName),
        data: JSON.stringify({ downloadId, fileName, savePath, size: stats.size })
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
        data: ''
      };
    }
  }

  /**
   * Get download progress by ID
   */
  getProgress(downloadId: string): DownloadProgress | null {
    return this.downloads.get(downloadId) || null;
  }

  /**
   * Get all download progress
   */
  getAllProgress(): DownloadProgress[] {
    return Array.from(this.downloads.values());
  }

  /**
   * Get active downloads
   */
  getActiveDownloads(): DownloadProgress[] {
    return Array.from(this.activeDownloads)
      .map(id => this.downloads.get(id))
      .filter(p => p !== undefined) as DownloadProgress[];
  }

  /**
   * Cancel a download
   */
  async cancelDownload(downloadId: string): Promise<DownloadResult> {
    const progress = this.downloads.get(downloadId);
    if (!progress) {
      return {
        success: false,
        error: 'Download not found',
        data: ''
      };
    }

    if (progress.state !== 'downloading') {
      return {
        success: false,
        error: `Cannot cancel download in state: ${progress.state}`,
        data: ''
      };
    }

    progress.state = 'cancelled';
    progress.endTime = Date.now();
    this.activeDownloads.delete(downloadId);
    this.emit('downloadCancelled', progress);

    return {
      success: true,
      downloadId,
      data: JSON.stringify({ downloadId })
    };
  }

  /**
   * Clear completed downloads from history
   */
  clearCompleted(): number {
    const completed = Array.from(this.downloads.entries())
      .filter(([_, progress]) => progress.state === 'completed' || progress.state === 'failed');
    
    completed.forEach(([id, _]) => this.downloads.delete(id));
    return completed.length;
  }

  /**
   * Wait for a download to complete
   */
  async waitForDownload(
    downloadId: string,
    timeout: number = 30000
  ): Promise<DownloadResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkProgress = setInterval(() => {
        const progress = this.downloads.get(downloadId);
        
        if (!progress) {
          clearInterval(checkProgress);
          resolve({
            success: false,
            error: 'Download not found',
            data: ''
          });
          return;
        }

        if (progress.state === 'completed') {
          clearInterval(checkProgress);
          resolve({
            success: true,
            downloadId,
            fileName: progress.fileName,
            savePath: progress.savePath,
            size: progress.totalBytes,
            data: JSON.stringify({ downloadId, fileName: progress.fileName, savePath: progress.savePath, size: progress.totalBytes })
          });
          return;
        }

        if (progress.state === 'failed' || progress.state === 'cancelled') {
          clearInterval(checkProgress);
          resolve({
            success: false,
            error: progress.error || `Download ${progress.state}`,
            data: ''
          });
          return;
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(checkProgress);
          resolve({
            success: false,
            error: 'Download timeout',
            data: ''
          });
          return;
        }
      }, 100);
    });
  }

  /**
   * Set default download directory
   */
  setDownloadDirectory(directory: string): void {
    this.downloadDir = directory;
    this.ensureDownloadDir();
  }

  /**
   * Get download statistics
   */
  getStatistics(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
    totalBytes: number;
    averageSpeed: number;
  } {
    const allDownloads = Array.from(this.downloads.values());
    
    return {
      total: allDownloads.length,
      active: this.activeDownloads.size,
      completed: allDownloads.filter(d => d.state === 'completed').length,
      failed: allDownloads.filter(d => d.state === 'failed').length,
      cancelled: allDownloads.filter(d => d.state === 'cancelled').length,
      totalBytes: allDownloads.reduce((sum, d) => sum + d.totalBytes, 0),
      averageSpeed: this.calculateAverageSpeed(allDownloads)
    };
  }

  /**
   * Calculate average download speed
   */
  private calculateAverageSpeed(downloads: DownloadProgress[]): number {
    const completed = downloads.filter(d => d.state === 'completed' && d.endTime);
    if (completed.length === 0) return 0;

    const totalSpeed = completed.reduce((sum, d) => {
      const duration = (d.endTime! - d.startTime) / 1000; // seconds
      const speed = d.totalBytes / duration; // bytes per second
      return sum + speed;
    }, 0);

    return totalSpeed / completed.length;
  }

  /**
   * Generate unique download ID
   */
  private generateDownloadId(): string {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}