/**
 * TabManager - Multi-tab management for browser automation
 * Provides AI-friendly tab switching and control
 */

import { Page, Browser, BrowserContext } from 'playwright-core';
import { formatResponse } from '../utils/responseFormatter';
import { ActionResult } from '../types';

export interface TabInfo {
  id: string;
  title: string;
  url: string;
  index: number;
  active: boolean;
  createdAt: number;
}

export interface TabResult extends ActionResult {
  tabId?: string;
  tabs?: TabInfo[];
}

/**
 * Manages multiple browser tabs with AI-optimized responses
 */
export class TabManager {
  private context: BrowserContext | null = null;
  private tabs: Map<string, Page> = new Map();
  private activeTabId: string | null = null;
  private tabCounter: number = 0;

  /**
   * Initialize the tab manager with browser and context
   */
  async initialize(_browser: Browser, context: BrowserContext): Promise<void> {
    // Browser is not needed currently but kept in signature for future use
    this.context = context;
    
    // Track existing pages
    const pages = context.pages();
    for (const page of pages) {
      const tabId = this.generateTabId();
      this.tabs.set(tabId, page);
      if (!this.activeTabId) {
        this.activeTabId = tabId;
      }
    }
  }

  /**
   * Generate a unique tab ID
   */
  private generateTabId(): string {
    return `tab-${++this.tabCounter}-${Date.now()}`;
  }

  /**
   * Open a new tab
   */
  async openTab(url?: string): Promise<TabResult> {
    try {
      if (!this.context) {
        return formatResponse({
          success: false,
          action: 'openTab',
          error: 'Tab manager not initialized',
          timestamp: Date.now()
        });
      }

      const page = await this.context.newPage();
      const tabId = this.generateTabId();
      this.tabs.set(tabId, page);

      if (url) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }

      // Make the new tab active
      this.activeTabId = tabId;

      return formatResponse({
        success: true,
        action: 'openTab',
        value: {
          tabId,
          title: await page.title(),
          url: page.url()
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'openTab',
        error: `Failed to open new tab: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Switch to a specific tab by ID
   */
  async switchTab(tabId: string): Promise<TabResult> {
    try {
      if (!this.tabs.has(tabId)) {
        return formatResponse({
          success: false,
          action: 'switchTab',
          error: `Tab ${tabId} not found`,
          timestamp: Date.now()
        });
      }

      const page = this.tabs.get(tabId)!;
      await page.bringToFront();
      this.activeTabId = tabId;

      return formatResponse({
        success: true,
        action: 'switchTab',
        value: {
          tabId,
          title: await page.title(),
          url: page.url()
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'switchTab',
        error: `Failed to switch tab: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Switch to tab by index (0-based)
   */
  async switchTabByIndex(index: number): Promise<TabResult> {
    try {
      const tabIds = Array.from(this.tabs.keys());
      if (index < 0 || index >= tabIds.length) {
        return formatResponse({
          success: false,
          action: 'switchTabByIndex',
          error: `Invalid tab index: ${index}`,
          timestamp: Date.now()
        });
      }

      return await this.switchTab(tabIds[index]);
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'switchTabByIndex',
        error: `Failed to switch tab by index: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Close a specific tab
   */
  async closeTab(tabId?: string): Promise<TabResult> {
    try {
      const targetId = tabId || this.activeTabId;
      if (!targetId || !this.tabs.has(targetId)) {
        return formatResponse({
          success: false,
          action: 'closeTab',
          error: `Tab ${targetId} not found`,
          timestamp: Date.now()
        });
      }

      const page = this.tabs.get(targetId)!;
      await page.close();
      this.tabs.delete(targetId);

      // Switch to another tab if we closed the active one
      if (targetId === this.activeTabId) {
        const remainingTabs = Array.from(this.tabs.keys());
        if (remainingTabs.length > 0) {
          this.activeTabId = remainingTabs[0];
          const newActivePage = this.tabs.get(this.activeTabId)!;
          await newActivePage.bringToFront();
        } else {
          this.activeTabId = null;
        }
      }

      return formatResponse({
        success: true,
        action: 'closeTab',
        value: { 
          closedTabId: targetId,
          activeTabId: this.activeTabId 
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'closeTab',
        error: `Failed to close tab: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get list of all tabs
   */
  async getTabs(): Promise<TabResult> {
    try {
      const tabInfos: TabInfo[] = [];
      let index = 0;

      for (const [tabId, page] of this.tabs.entries()) {
        tabInfos.push({
          id: tabId,
          title: await page.title(),
          url: page.url(),
          index: index++,
          active: tabId === this.activeTabId,
          createdAt: parseInt(tabId.split('-')[2] || '0')
        });
      }

      return formatResponse({
        success: true,
        action: 'getTabs',
        value: { tabs: tabInfos },
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'getTabs',
        error: `Failed to get tabs: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get the active tab
   */
  getActiveTab(): Page | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  /**
   * Get a tab by ID
   */
  getTab(tabId: string): Page | null {
    return this.tabs.get(tabId) || null;
  }

  /**
   * Get the active tab ID
   */
  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /**
   * Navigate in a specific tab
   */
  async navigateInTab(tabId: string, url: string): Promise<TabResult> {
    try {
      if (!this.tabs.has(tabId)) {
        return formatResponse({
          success: false,
          action: 'navigateInTab',
          error: `Tab ${tabId} not found`,
          timestamp: Date.now()
        });
      }

      const page = this.tabs.get(tabId)!;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      return formatResponse({
        success: true,
        action: 'navigateInTab',
        value: {
          tabId,
          title: await page.title(),
          url: page.url()
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'navigateInTab',
        error: `Failed to navigate in tab: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Reload a specific tab
   */
  async reloadTab(tabId?: string): Promise<TabResult> {
    try {
      const targetId = tabId || this.activeTabId;
      if (!targetId || !this.tabs.has(targetId)) {
        return formatResponse({
          success: false,
          action: 'reloadTab',
          error: `Tab ${targetId} not found`,
          timestamp: Date.now()
        });
      }

      const page = this.tabs.get(targetId)!;
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

      return formatResponse({
        success: true,
        action: 'reloadTab',
        value: {
          tabId: targetId,
          title: await page.title(),
          url: page.url()
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'reloadTab',
        error: `Failed to reload tab: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Duplicate a tab
   */
  async duplicateTab(tabId?: string): Promise<TabResult> {
    try {
      const sourceId = tabId || this.activeTabId;
      if (!sourceId || !this.tabs.has(sourceId)) {
        return formatResponse({
          success: false,
          action: 'duplicateTab',
          error: `Tab ${sourceId} not found`,
          timestamp: Date.now()
        });
      }

      const sourcePage = this.tabs.get(sourceId)!;
      const url = sourcePage.url();

      // Open new tab with same URL
      return await this.openTab(url);
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'duplicateTab',
        error: `Failed to duplicate tab: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Move tab to a different position
   */
  async moveTab(tabId: string, newIndex: number): Promise<TabResult> {
    try {
      const tabIds = Array.from(this.tabs.keys());
      const currentIndex = tabIds.indexOf(tabId);

      if (currentIndex === -1) {
        return formatResponse({
          success: false,
          action: 'moveTab',
          error: `Tab ${tabId} not found`,
          timestamp: Date.now()
        });
      }

      if (newIndex < 0 || newIndex >= tabIds.length) {
        return formatResponse({
          success: false,
          action: 'moveTab',
          error: `Invalid new index: ${newIndex}`,
          timestamp: Date.now()
        });
      }

      // Reorder tabs in the map
      tabIds.splice(currentIndex, 1);
      tabIds.splice(newIndex, 0, tabId);

      const newTabs = new Map<string, Page>();
      for (const id of tabIds) {
        newTabs.set(id, this.tabs.get(id)!);
      }
      this.tabs = newTabs;

      return formatResponse({
        success: true,
        action: 'moveTab',
        value: { 
          tabId,
          newIndex,
          tabs: tabIds
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'moveTab',
        error: `Failed to move tab: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Close all tabs except one
   */
  async closeOtherTabs(tabId?: string): Promise<TabResult> {
    try {
      const keepId = tabId || this.activeTabId;
      if (!keepId || !this.tabs.has(keepId)) {
        return formatResponse({
          success: false,
          action: 'closeOtherTabs',
          error: `Tab ${keepId} not found`,
          timestamp: Date.now()
        });
      }

      const tabsToClose = Array.from(this.tabs.keys()).filter(id => id !== keepId);
      
      for (const id of tabsToClose) {
        const page = this.tabs.get(id)!;
        await page.close();
        this.tabs.delete(id);
      }

      this.activeTabId = keepId;

      return formatResponse({
        success: true,
        action: 'closeOtherTabs',
        value: {
          keptTabId: keepId,
          closedCount: tabsToClose.length
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'closeOtherTabs',
        error: `Failed to close other tabs: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Search for a tab by title or URL
   */
  async findTab(query: string): Promise<TabResult> {
    try {
      const lowerQuery = query.toLowerCase();
      
      for (const [tabId, page] of this.tabs.entries()) {
        const title = (await page.title()).toLowerCase();
        const url = page.url().toLowerCase();
        
        if (title.includes(lowerQuery) || url.includes(lowerQuery)) {
          return formatResponse({
            success: true,
            action: 'findTab',
            value: {
              tabId,
              title: await page.title(),
              url: page.url()
            },
            timestamp: Date.now()
          });
        }
      }

      return formatResponse({
        success: false,
        action: 'findTab',
        error: `No tab found matching: ${query}`,
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'findTab',
        error: `Failed to find tab: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      for (const page of this.tabs.values()) {
        await page.close();
      }
      this.tabs.clear();
      this.activeTabId = null;
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

export default TabManager;