/**
 * SessionManager - Manages browser session state and persistence
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { BrowserContext, Page } from 'playwright-core';
import { SessionData, PageState, ActionResult } from '../types';
import { formatError, formatSuccess } from '../utils/responseFormatter';

export class SessionManager {
  private sessionPath: string;
  private sessionId: string;
  private sessionData: SessionData | null = null;
  private autoSave: boolean = true;
  private saveInterval: NodeJS.Timeout | null = null;

  constructor(sessionPath?: string, autoSave: boolean = true) {
    this.sessionPath = sessionPath || path.join(process.cwd(), 'sessions');
    this.sessionId = this.generateSessionId();
    this.autoSave = autoSave;
    
    // Ensure session directory exists
    this.ensureSessionDirectory();
    
    // Start auto-save if enabled
    if (this.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Ensure session directory exists
   */
  private async ensureSessionDirectory(): Promise<void> {
    try {
      await fs.access(this.sessionPath);
    } catch {
      await fs.mkdir(this.sessionPath, { recursive: true });
    }
  }

  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    this.saveInterval = setInterval(() => {
      if (this.sessionData) {
        this.save().catch(console.error);
      }
    }, 30000); // Save every 30 seconds
  }

  /**
   * Stop auto-save interval
   */
  private stopAutoSave(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  /**
   * Initialize session from browser context
   */
  async initialize(context: BrowserContext, page: Page): Promise<ActionResult> {
    try {
      const state = await this.captureState(context, page);
      
      this.sessionData = {
        id: this.sessionId,
        created: Date.now(),
        updated: Date.now(),
        state,
        history: [page.url()],
        metadata: {
          userAgent: await page.evaluate(() => (navigator as any).userAgent),
          platform: await page.evaluate(() => (navigator as any).platform),
        },
      };

      return formatSuccess('initializeSession', {
        sessionId: this.sessionId,
        url: state.url,
      });
    } catch (error) {
      return formatError(error as Error, 'initializeSession');
    }
  }

  /**
   * Capture current page state
   */
  async captureState(context: BrowserContext, page: Page): Promise<PageState> {
    const cookies = await context.cookies();
    
    // Get localStorage and sessionStorage
    const storageData = await page.evaluate(() => {
      const getStorage = (storage: Storage) => {
        const data: Record<string, string> = {};
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key) {
            data[key] = storage.getItem(key) || '';
          }
        }
        return data;
      };

      return {
        localStorage: getStorage(localStorage),
        sessionStorage: getStorage(sessionStorage),
      };
    });

    const viewport = page.viewportSize() || { width: 1280, height: 720 };

    return {
      url: page.url(),
      title: await page.title(),
      cookies,
      localStorage: storageData.localStorage,
      sessionStorage: storageData.sessionStorage,
      viewport,
      timestamp: Date.now(),
    };
  }

  /**
   * Update session with new state
   */
  async update(context: BrowserContext, page: Page): Promise<ActionResult> {
    if (!this.sessionData) {
      return formatError('Session not initialized', 'updateSession');
    }

    try {
      const state = await this.captureState(context, page);
      
      // Update history if URL changed
      if (state.url !== this.sessionData.state.url) {
        this.sessionData.history.push(state.url);
        // Keep only last 100 URLs
        if (this.sessionData.history.length > 100) {
          this.sessionData.history = this.sessionData.history.slice(-100);
        }
      }

      this.sessionData.state = state;
      this.sessionData.updated = Date.now();

      return formatSuccess('updateSession', {
        sessionId: this.sessionId,
        url: state.url,
        historyLength: this.sessionData.history.length,
      });
    } catch (error) {
      return formatError(error as Error, 'updateSession');
    }
  }

  /**
   * Restore session to browser context
   */
  async restore(context: BrowserContext, sessionId?: string): Promise<ActionResult> {
    try {
      const targetSessionId = sessionId || this.sessionId;
      const sessionFile = path.join(this.sessionPath, `${targetSessionId}.json`);
      
      // Load session data
      const data = await fs.readFile(sessionFile, 'utf-8');
      this.sessionData = JSON.parse(data);
      
      if (!this.sessionData) {
        return formatError('Invalid session data', 'restoreSession');
      }

      // Create new page with restored state
      const page = await context.newPage();
      
      // Restore cookies
      if (this.sessionData.state.cookies.length > 0) {
        await context.addCookies(this.sessionData.state.cookies);
      }

      // Navigate to last URL
      await page.goto(this.sessionData.state.url);

      // Restore localStorage and sessionStorage
      await page.evaluate((storageData) => {
        // Restore localStorage
        Object.entries(storageData.localStorage).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
        
        // Restore sessionStorage
        Object.entries(storageData.sessionStorage).forEach(([key, value]) => {
          sessionStorage.setItem(key, value);
        });
      }, {
        localStorage: this.sessionData.state.localStorage,
        sessionStorage: this.sessionData.state.sessionStorage,
      });

      return formatSuccess('restoreSession', {
        sessionId: targetSessionId,
        url: this.sessionData.state.url,
        created: this.sessionData.created,
        updated: this.sessionData.updated,
      });
    } catch (error) {
      return formatError(error as Error, 'restoreSession');
    }
  }

  /**
   * Save session to disk
   */
  async save(): Promise<ActionResult> {
    if (!this.sessionData) {
      return formatError('No session data to save', 'saveSession');
    }

    try {
      const sessionFile = path.join(this.sessionPath, `${this.sessionId}.json`);
      await fs.writeFile(sessionFile, JSON.stringify(this.sessionData, null, 2));
      
      return formatSuccess('saveSession', {
        sessionId: this.sessionId,
        path: sessionFile,
        size: JSON.stringify(this.sessionData).length,
      });
    } catch (error) {
      return formatError(error as Error, 'saveSession');
    }
  }

  /**
   * List available sessions
   */
  async listSessions(): Promise<ActionResult> {
    try {
      const files = await fs.readdir(this.sessionPath);
      const sessions = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionFile = path.join(this.sessionPath, file);
          const stats = await fs.stat(sessionFile);
          const data = await fs.readFile(sessionFile, 'utf-8');
          const sessionData: SessionData = JSON.parse(data);
          
          sessions.push({
            id: sessionData.id,
            created: sessionData.created,
            updated: sessionData.updated,
            url: sessionData.state.url,
            title: sessionData.state.title,
            size: stats.size,
          });
        }
      }

      return formatSuccess('listSessions', sessions);
    } catch (error) {
      return formatError(error as Error, 'listSessions');
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<ActionResult> {
    try {
      const sessionFile = path.join(this.sessionPath, `${sessionId}.json`);
      await fs.unlink(sessionFile);
      
      return formatSuccess('deleteSession', { sessionId });
    } catch (error) {
      return formatError(error as Error, 'deleteSession');
    }
  }

  /**
   * Clear all sessions
   */
  async clearSessions(): Promise<ActionResult> {
    try {
      const files = await fs.readdir(this.sessionPath);
      let deleted = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.sessionPath, file));
          deleted++;
        }
      }

      return formatSuccess('clearSessions', { deleted });
    } catch (error) {
      return formatError(error as Error, 'clearSessions');
    }
  }

  /**
   * Get current session data
   */
  getSessionData(): SessionData | null {
    return this.sessionData;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopAutoSave();
  }
}