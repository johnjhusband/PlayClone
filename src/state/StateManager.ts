/**
 * StateManager - Manages browser state checkpoints and rollback
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { PageState, ActionResult } from '../types';
import { formatSuccess, formatError } from '../utils/responseFormatter';

interface StateCheckpoint {
  id: string;
  name?: string;
  state: PageState;
  created: number;
  metadata?: Record<string, any>;
}

export class StateManager {
  private checkpoints: Map<string, StateCheckpoint> = new Map();
  private checkpointDir: string;
  private maxCheckpoints: number = 50;
  private autoSave: boolean = true;

  constructor(checkpointDir?: string, maxCheckpoints: number = 50) {
    this.checkpointDir = checkpointDir || path.join(process.cwd(), 'checkpoints');
    this.maxCheckpoints = maxCheckpoints;
    this.ensureCheckpointDirectory();
  }

  /**
   * Ensure checkpoint directory exists
   */
  private async ensureCheckpointDirectory(): Promise<void> {
    try {
      await fs.access(this.checkpointDir);
    } catch {
      await fs.mkdir(this.checkpointDir, { recursive: true });
    }
  }

  /**
   * Generate checkpoint ID
   */
  private generateCheckpointId(): string {
    return `checkpoint_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Save state from a page (test-compatible method)
   */
  async saveState(page: any, name?: string, options?: any): Promise<any> {
    // Extract page state
    const state: PageState = {
      url: page.url(),
      title: await page.title(),
      cookies: await page.context().cookies(),
      localStorage: options?.includeLocalStorage ? await page.evaluate(() => ({ ...localStorage })) : undefined,
      sessionStorage: options?.includeSessionStorage ? await page.evaluate(() => ({ ...sessionStorage })) : undefined,
      scrollPosition: { x: 0, y: 0 },
      viewportSize: page.viewportSize(),
      timestamp: Date.now()
    };

    const checkpointName = name || `checkpoint-${Date.now()}`;
    const result = await this.saveCheckpoint(state, checkpointName, options);
    
    if (result.success && (result as any).data) {
      return {
        id: (result as any).data.id,
        name: checkpointName,
        url: state.url,
        title: state.title,
        timestamp: state.timestamp,
        cookies: state.cookies,
        localStorage: state.localStorage,
        sessionStorage: state.sessionStorage,
        screenshot: options?.includeScreenshot ? await page.screenshot() : undefined
      };
    }
    
    throw new Error(result.error || 'Failed to save state');
  }

  /**
   * Restore state to a page (test-compatible method)  
   */
  async restoreState(page: any, checkpoint: any): Promise<void> {
    if (checkpoint.url) {
      await page.goto(checkpoint.url);
    }

    if (checkpoint.cookies && checkpoint.cookies.length > 0) {
      await page.context().addCookies(checkpoint.cookies);
    }

    if (checkpoint.localStorage) {
      await page.evaluate((storage: any) => {
        Object.entries(storage).forEach(([key, value]) => {
          localStorage.setItem(key, value as string);
        });
      }, checkpoint.localStorage);
    }

    if (checkpoint.sessionStorage) {
      await page.evaluate((storage: any) => {
        Object.entries(storage).forEach(([key, value]) => {
          sessionStorage.setItem(key, value as string);
        });
      }, checkpoint.sessionStorage);
    }

    if (checkpoint.scrollPosition) {
      await page.evaluate((pos: any) => {
        window.scrollTo(pos.x, pos.y);
      }, checkpoint.scrollPosition);
    }
  }

  /**
   * Save a state checkpoint
   */
  async saveCheckpoint(state: PageState, name?: string, metadata?: Record<string, any>): Promise<ActionResult> {
    try {
      const id = this.generateCheckpointId();
      const checkpoint: StateCheckpoint = {
        id,
        name: name || `Checkpoint at ${new Date().toISOString()}`,
        state,
        created: Date.now(),
        metadata,
      };

      // Add to memory
      this.checkpoints.set(id, checkpoint);

      // Enforce max checkpoints limit
      if (this.checkpoints.size > this.maxCheckpoints) {
        // Remove oldest checkpoint
        const oldest = Array.from(this.checkpoints.values())
          .sort((a, b) => a.created - b.created)[0];
        this.checkpoints.delete(oldest.id);
        
        // Delete from disk if exists
        if (this.autoSave) {
          const filePath = path.join(this.checkpointDir, `${oldest.id}.json`);
          await fs.unlink(filePath).catch(() => {}); // Ignore if doesn't exist
        }
      }

      // Save to disk if auto-save enabled
      if (this.autoSave) {
        const filePath = path.join(this.checkpointDir, `${id}.json`);
        await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2));
      }

      return formatSuccess('saveCheckpoint', {
        id,
        name: checkpoint.name,
        url: state.url,
        created: checkpoint.created,
      });
    } catch (error) {
      return formatError(error as Error, 'saveCheckpoint');
    }
  }

  /**
   * Restore a checkpoint by ID or name
   */
  async restoreCheckpoint(identifier: string): Promise<ActionResult> {
    try {
      // Find checkpoint by ID or name
      let checkpoint = this.checkpoints.get(identifier);
      
      if (!checkpoint) {
        // Try to find by name
        checkpoint = Array.from(this.checkpoints.values())
          .find(cp => cp.name === identifier);
      }

      if (!checkpoint) {
        // Try to load from disk
        const loaded = await this.loadCheckpointFromDisk(identifier);
        if (loaded) {
          checkpoint = loaded;
        }
      }

      if (!checkpoint) {
        return formatError(`Checkpoint not found: ${identifier}`, 'restoreCheckpoint');
      }

      return formatSuccess('restoreCheckpoint', {
        id: checkpoint.id,
        name: checkpoint.name,
        state: checkpoint.state,
        created: checkpoint.created,
      });
    } catch (error) {
      return formatError(error as Error, 'restoreCheckpoint');
    }
  }

  /**
   * Load checkpoint from disk
   */
  private async loadCheckpointFromDisk(identifier: string): Promise<StateCheckpoint | null> {
    try {
      // Try direct ID first
      let filePath = path.join(this.checkpointDir, `${identifier}.json`);
      
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const checkpoint = JSON.parse(data) as StateCheckpoint;
        this.checkpoints.set(checkpoint.id, checkpoint);
        return checkpoint;
      } catch {
        // Not found by ID, try searching all files
        const files = await fs.readdir(this.checkpointDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const data = await fs.readFile(path.join(this.checkpointDir, file), 'utf-8');
            const checkpoint = JSON.parse(data) as StateCheckpoint;
            
            if (checkpoint.name === identifier || checkpoint.id === identifier) {
              this.checkpoints.set(checkpoint.id, checkpoint);
              return checkpoint;
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load checkpoint from disk:', error);
    }
    
    return null;
  }

  /**
   * List all checkpoints
   */
  async listCheckpoints(): Promise<ActionResult> {
    try {
      // Combine memory and disk checkpoints
      const checkpoints = new Map(this.checkpoints);

      // Load from disk if needed
      if (this.autoSave) {
        const files = await fs.readdir(this.checkpointDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const id = file.replace('.json', '');
            if (!checkpoints.has(id)) {
              const checkpoint = await this.loadCheckpointFromDisk(id);
              if (checkpoint) {
                checkpoints.set(id, checkpoint);
              }
            }
          }
        }
      }

      // Convert to list and sort by creation time
      const list = Array.from(checkpoints.values())
        .sort((a, b) => b.created - a.created)
        .map(cp => ({
          id: cp.id,
          name: cp.name,
          url: cp.state.url,
          title: cp.state.title,
          created: cp.created,
          metadata: cp.metadata,
        }));

      return formatSuccess('listCheckpoints', {
        checkpoints: list,
        count: list.length,
      });
    } catch (error) {
      return formatError(error as Error, 'listCheckpoints');
    }
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(identifier: string): Promise<ActionResult> {
    try {
      // Find checkpoint
      let checkpoint = this.checkpoints.get(identifier);
      
      if (!checkpoint) {
        checkpoint = Array.from(this.checkpoints.values())
          .find(cp => cp.name === identifier);
      }

      if (!checkpoint) {
        return formatError(`Checkpoint not found: ${identifier}`, 'deleteCheckpoint');
      }

      // Remove from memory
      this.checkpoints.delete(checkpoint.id);

      // Remove from disk
      if (this.autoSave) {
        const filePath = path.join(this.checkpointDir, `${checkpoint.id}.json`);
        await fs.unlink(filePath).catch(() => {}); // Ignore if doesn't exist
      }

      return formatSuccess('deleteCheckpoint', {
        id: checkpoint.id,
        name: checkpoint.name,
      });
    } catch (error) {
      return formatError(error as Error, 'deleteCheckpoint');
    }
  }

  /**
   * Clear all checkpoints
   */
  async clearCheckpoints(): Promise<ActionResult> {
    try {
      const count = this.checkpoints.size;
      
      // Clear memory
      this.checkpoints.clear();

      // Clear disk
      if (this.autoSave) {
        const files = await fs.readdir(this.checkpointDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(this.checkpointDir, file));
          }
        }
      }

      return formatSuccess('clearCheckpoints', {
        deleted: count,
      });
    } catch (error) {
      return formatError(error as Error, 'clearCheckpoints');
    }
  }

  /**
   * Compare two states
   */
  compareStates(state1: PageState, state2: PageState): Record<string, any> {
    const differences: Record<string, any> = {};

    // Compare URLs
    if (state1.url !== state2.url) {
      differences.url = { from: state1.url, to: state2.url };
    }

    // Compare titles
    if (state1.title !== state2.title) {
      differences.title = { from: state1.title, to: state2.title };
    }

    // Compare cookies
    const cookieDiff = this.compareCookies(state1.cookies, state2.cookies);
    if (cookieDiff.added.length > 0 || cookieDiff.removed.length > 0 || cookieDiff.modified.length > 0) {
      differences.cookies = cookieDiff;
    }

    // Compare localStorage
    if (state1.localStorage && state2.localStorage) {
      const localStorageDiff = this.compareStorage(state1.localStorage, state2.localStorage);
      if (localStorageDiff.added.length > 0 || localStorageDiff.removed.length > 0 || localStorageDiff.modified.length > 0) {
        differences.localStorage = localStorageDiff;
      }
    }

    // Compare sessionStorage
    if (state1.sessionStorage && state2.sessionStorage) {
      const sessionStorageDiff = this.compareStorage(state1.sessionStorage, state2.sessionStorage);
      if (sessionStorageDiff.added.length > 0 || sessionStorageDiff.removed.length > 0 || sessionStorageDiff.modified.length > 0) {
        differences.sessionStorage = sessionStorageDiff;
      }
    }

    return differences;
  }

  /**
   * Compare cookies
   */
  private compareCookies(cookies1: any[], cookies2: any[]) {
    const map1 = new Map(cookies1.map(c => [c.name, c]));
    const map2 = new Map(cookies2.map(c => [c.name, c]));

    const added = cookies2.filter(c => !map1.has(c.name));
    const removed = cookies1.filter(c => !map2.has(c.name));
    const modified = cookies2.filter(c => {
      const old = map1.get(c.name);
      return old && old.value !== c.value;
    });

    return { added, removed, modified };
  }

  /**
   * Compare storage objects
   */
  private compareStorage(storage1: Record<string, string>, storage2: Record<string, string>) {
    const keys1 = new Set(Object.keys(storage1));
    const keys2 = new Set(Object.keys(storage2));

    const added = Array.from(keys2).filter(k => !keys1.has(k)).map(k => ({ key: k, value: storage2[k] }));
    const removed = Array.from(keys1).filter(k => !keys2.has(k)).map(k => ({ key: k, value: storage1[k] }));
    const modified = Array.from(keys2).filter(k => keys1.has(k) && storage1[k] !== storage2[k])
      .map(k => ({ key: k, oldValue: storage1[k], newValue: storage2[k] }));

    return { added, removed, modified };
  }

  /**
   * Export checkpoints to file
   */
  async exportCheckpoints(exportPath: string): Promise<ActionResult> {
    try {
      const list = await this.listCheckpoints();
      
      if (!list.success) {
        return list;
      }

      const checkpoints = Array.from(this.checkpoints.values());
      const exportData = {
        version: '1.0',
        exported: Date.now(),
        checkpoints,
      };

      await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));

      return formatSuccess('exportCheckpoints', {
        path: exportPath,
        count: checkpoints.length,
      });
    } catch (error) {
      return formatError(error as Error, 'exportCheckpoints');
    }
  }

  /**
   * Import checkpoints from file
   */
  async importCheckpoints(importPath: string): Promise<ActionResult> {
    try {
      const data = await fs.readFile(importPath, 'utf-8');
      const importData = JSON.parse(data);

      if (!importData.checkpoints || !Array.isArray(importData.checkpoints)) {
        return formatError('Invalid checkpoint file format', 'importCheckpoints');
      }

      let imported = 0;
      for (const checkpoint of importData.checkpoints) {
        this.checkpoints.set(checkpoint.id, checkpoint);
        
        if (this.autoSave) {
          const filePath = path.join(this.checkpointDir, `${checkpoint.id}.json`);
          await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2));
        }
        
        imported++;
      }

      return formatSuccess('importCheckpoints', {
        imported,
        path: importPath,
      });
    } catch (error) {
      return formatError(error as Error, 'importCheckpoints');
    }
  }
}