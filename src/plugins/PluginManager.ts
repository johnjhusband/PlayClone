/**
 * Plugin System for PlayClone
 * Allows extending PlayClone functionality through plugins
 */

import { PlayClone } from '../PlayClone';
import * as fs from 'fs';
import * as path from 'path';

export interface Plugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  init: (playclone: PlayClone) => void | Promise<void>;
  cleanup?: () => void | Promise<void>;
  hooks?: {
    beforeNavigate?: (url: string) => void | Promise<void>;
    afterNavigate?: (url: string) => void | Promise<void>;
    beforeClick?: (selector: string) => void | Promise<void>;
    afterClick?: (selector: string) => void | Promise<void>;
    onError?: (error: Error) => void | Promise<void>;
  };
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private playclone: PlayClone;
  private pluginDir: string = './plugin-storage';

  constructor(playclone: PlayClone) {
    this.playclone = playclone;
    this.ensurePluginDirectory();
  }

  private ensurePluginDirectory(): void {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }
  }

  /**
   * Load a plugin from a file or module
   */
  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const plugin: Plugin = require(pluginPath);

      if (!plugin.name || !plugin.init) {
        throw new Error('Invalid plugin: missing name or init function');
      }

      if (this.plugins.has(plugin.name)) {
        console.warn(`Plugin ${plugin.name} already loaded, skipping`);
        return;
      }

      // Initialize the plugin
      await plugin.init(this.playclone);
      this.plugins.set(plugin.name, plugin);

      console.log(`[PluginManager] Loaded plugin: ${plugin.name} v${plugin.version || '1.0.0'}`);
    } catch (error) {
      console.error(`[PluginManager] Failed to load plugin from ${pluginPath}:`, error);
      throw error;
    }
  }

  /**
   * Load all plugins from the plugin directory
   */
  async loadAllPlugins(): Promise<void> {
    const files = fs.readdirSync(this.pluginDir);
    const pluginFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts'));

    for (const file of pluginFiles) {
      const pluginPath = path.join(this.pluginDir, file);
      try {
        await this.loadPlugin(pluginPath);
      } catch (error) {
        console.error(`Failed to load plugin ${file}:`, error);
      }
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    if (plugin.cleanup) {
      await plugin.cleanup();
    }

    this.plugins.delete(pluginName);
    console.log(`[PluginManager] Unloaded plugin: ${pluginName}`);
  }

  /**
   * Execute hooks for all loaded plugins
   */
  async executeHook(hookName: keyof NonNullable<Plugin['hooks']>, ...args: any[]): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.hooks && plugin.hooks[hookName]) {
        try {
          await (plugin.hooks[hookName] as any)(...args);
        } catch (error) {
          console.error(`[PluginManager] Error in plugin ${name} hook ${hookName}:`, error);
        }
      }
    }
  }

  /**
   * Get list of loaded plugins
   */
  getLoadedPlugins(): Array<{ name: string; version: string; description?: string }> {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version,
      description: p.description
    }));
  }

  /**
   * Check if a plugin is loaded
   */
  isPluginLoaded(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  /**
   * Cleanup all plugins
   */
  async cleanup(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.cleanup) {
        try {
          await plugin.cleanup();
        } catch (error) {
          console.error(`[PluginManager] Error cleaning up plugin ${name}:`, error);
        }
      }
    }
    this.plugins.clear();
  }
}

export default PluginManager;