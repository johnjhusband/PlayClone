import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { PlayClone } from '../PlayClone';
import { BrowserManager } from '../core/BrowserManager';
import { Page } from 'playwright-core';

export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: Record<string, string>;
  engines?: {
    playclone?: string;
    node?: string;
  };
  keywords?: string[];
  homepage?: string;
  license?: string;
}

export interface PluginConfig {
  enabled: boolean;
  priority?: number;
  settings?: Record<string, any>;
}

export interface PluginContext {
  playclone: PlayClone;
  browser?: BrowserManager;
  page?: Page;
  config: PluginConfig;
  logger: PluginLogger;
  storage: PluginStorage;
  api: PluginAPI;
}

export interface PluginLogger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface PluginStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PluginAPI {
  registerCommand(name: string, handler: CommandHandler): void;
  registerHook(event: string, handler: HookHandler): void;
  registerSelector(name: string, handler: SelectorHandler): void;
  registerExtractor(name: string, handler: ExtractorHandler): void;
  emit(event: string, data?: any): void;
}

export type CommandHandler = (args: any, context: PluginContext) => Promise<any>;
export type HookHandler = (data: any, context: PluginContext) => Promise<any>;
export type SelectorHandler = (selector: string, page: Page) => Promise<any>;
export type ExtractorHandler = (page: Page, options?: any) => Promise<any>;

export interface PlayClonePlugin {
  metadata: PluginMetadata;
  
  onLoad?(context: PluginContext): Promise<void>;
  onUnload?(context: PluginContext): Promise<void>;
  
  onBeforeNavigate?(url: string, context: PluginContext): Promise<void>;
  onAfterNavigate?(url: string, context: PluginContext): Promise<void>;
  
  onBeforeClick?(selector: string, context: PluginContext): Promise<void>;
  onAfterClick?(selector: string, context: PluginContext): Promise<void>;
  
  onBeforeFill?(selector: string, value: string, context: PluginContext): Promise<void>;
  onAfterFill?(selector: string, value: string, context: PluginContext): Promise<void>;
  
  onBeforeExtract?(type: string, context: PluginContext): Promise<void>;
  onAfterExtract?(type: string, data: any, context: PluginContext): Promise<any>;
  
  onError?(error: Error, context: PluginContext): Promise<void>;
  
  commands?: Record<string, CommandHandler>;
  hooks?: Record<string, HookHandler>;
  selectors?: Record<string, SelectorHandler>;
  extractors?: Record<string, ExtractorHandler>;
}

export class PluginManager extends EventEmitter {
  private plugins: Map<string, PlayClonePlugin> = new Map();
  private pluginConfigs: Map<string, PluginConfig> = new Map();
  private pluginInstances: Map<string, any> = new Map();
  private commands: Map<string, { plugin: string; handler: CommandHandler }> = new Map();
  private hooks: Map<string, Array<{ plugin: string; handler: HookHandler }>> = new Map();
  private selectors: Map<string, { plugin: string; handler: SelectorHandler }> = new Map();
  private extractors: Map<string, { plugin: string; handler: ExtractorHandler }> = new Map();
  private storageDir: string;
  private playclone?: PlayClone;

  constructor(storageDir: string = './plugin-storage') {
    super();
    this.storageDir = storageDir;
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async loadPlugin(pluginPath: string, config?: PluginConfig): Promise<void> {
    try {
      const absolutePath = path.resolve(pluginPath);
      
      // Load plugin module
      const pluginModule = await import(absolutePath);
      const PluginClass = pluginModule.default || pluginModule;
      
      // Create plugin instance
      const plugin: PlayClonePlugin = typeof PluginClass === 'function' 
        ? new PluginClass() 
        : PluginClass;
      
      if (!plugin.metadata || !plugin.metadata.name) {
        throw new Error(`Invalid plugin: missing metadata or name at ${pluginPath}`);
      }
      
      const pluginName = plugin.metadata.name;
      
      // Check for duplicates
      if (this.plugins.has(pluginName)) {
        throw new Error(`Plugin ${pluginName} is already loaded`);
      }
      
      // Store plugin and config
      this.plugins.set(pluginName, plugin);
      this.pluginConfigs.set(pluginName, config || { enabled: true, priority: 0 });
      this.pluginInstances.set(pluginName, plugin);
      
      // Create plugin context
      const context = this.createPluginContext(pluginName);
      
      // Register plugin components
      if (plugin.commands) {
        for (const [cmdName, handler] of Object.entries(plugin.commands)) {
          this.commands.set(cmdName, { plugin: pluginName, handler });
        }
      }
      
      if (plugin.hooks) {
        for (const [event, handler] of Object.entries(plugin.hooks)) {
          if (!this.hooks.has(event)) {
            this.hooks.set(event, []);
          }
          this.hooks.get(event)!.push({ plugin: pluginName, handler });
        }
      }
      
      if (plugin.selectors) {
        for (const [name, handler] of Object.entries(plugin.selectors)) {
          this.selectors.set(name, { plugin: pluginName, handler });
        }
      }
      
      if (plugin.extractors) {
        for (const [name, handler] of Object.entries(plugin.extractors)) {
          this.extractors.set(name, { plugin: pluginName, handler });
        }
      }
      
      // Call onLoad lifecycle
      if (plugin.onLoad) {
        await plugin.onLoad(context);
      }
      
      this.emit('plugin:loaded', { name: pluginName, plugin });
      console.log(`Plugin loaded: ${pluginName} v${plugin.metadata.version}`);
      
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      throw error;
    }
  }

  async loadPluginFromNpm(packageName: string, config?: PluginConfig): Promise<void> {
    try {
      const pluginModule = await import(packageName);
      const PluginClass = pluginModule.default || pluginModule;
      
      const plugin: PlayClonePlugin = typeof PluginClass === 'function' 
        ? new PluginClass() 
        : PluginClass;
      
      if (!plugin.metadata || !plugin.metadata.name) {
        throw new Error(`Invalid npm plugin: ${packageName}`);
      }
      
      const pluginName = plugin.metadata.name;
      
      if (this.plugins.has(pluginName)) {
        throw new Error(`Plugin ${pluginName} is already loaded`);
      }
      
      this.plugins.set(pluginName, plugin);
      this.pluginConfigs.set(pluginName, config || { enabled: true, priority: 0 });
      this.pluginInstances.set(pluginName, plugin);
      
      const context = this.createPluginContext(pluginName);
      
      if (plugin.onLoad) {
        await plugin.onLoad(context);
      }
      
      this.emit('plugin:loaded', { name: pluginName, plugin });
      
    } catch (error) {
      console.error(`Failed to load npm plugin ${packageName}:`, error);
      throw error;
    }
  }

  async unloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not loaded`);
    }
    
    const context = this.createPluginContext(pluginName);
    
    // Call onUnload lifecycle
    if (plugin.onUnload) {
      await plugin.onUnload(context);
    }
    
    // Remove registered components
    for (const [cmdName, cmd] of this.commands.entries()) {
      if (cmd.plugin === pluginName) {
        this.commands.delete(cmdName);
      }
    }
    
    for (const [event, handlers] of this.hooks.entries()) {
      const filtered = handlers.filter(h => h.plugin !== pluginName);
      if (filtered.length > 0) {
        this.hooks.set(event, filtered);
      } else {
        this.hooks.delete(event);
      }
    }
    
    for (const [name, sel] of this.selectors.entries()) {
      if (sel.plugin === pluginName) {
        this.selectors.delete(name);
      }
    }
    
    for (const [name, ext] of this.extractors.entries()) {
      if (ext.plugin === pluginName) {
        this.extractors.delete(name);
      }
    }
    
    // Clean up
    this.plugins.delete(pluginName);
    this.pluginConfigs.delete(pluginName);
    this.pluginInstances.delete(pluginName);
    
    this.emit('plugin:unloaded', { name: pluginName });
    console.log(`Plugin unloaded: ${pluginName}`);
  }

  async reloadPlugin(pluginName: string): Promise<void> {
    const config = this.pluginConfigs.get(pluginName);
    if (!config) {
      throw new Error(`Plugin ${pluginName} is not loaded`);
    }
    
    await this.unloadPlugin(pluginName);
    // Note: In real implementation, we'd need to track the original path
    // For now, this is a placeholder for the reload functionality
    this.emit('plugin:reloaded', { name: pluginName });
  }

  async executeCommand(commandName: string, args: any, context?: Partial<PluginContext>): Promise<any> {
    const command = this.commands.get(commandName);
    if (!command) {
      throw new Error(`Command ${commandName} not found`);
    }
    
    const fullContext = this.createPluginContext(command.plugin, context);
    return await command.handler(args, fullContext);
  }

  async executeHook(event: string, data: any, context?: Partial<PluginContext>): Promise<any[]> {
    const handlers = this.hooks.get(event) || [];
    const results: any[] = [];
    
    // Sort by priority
    const sorted = handlers.sort((a, b) => {
      const configA = this.pluginConfigs.get(a.plugin);
      const configB = this.pluginConfigs.get(b.plugin);
      return (configB?.priority || 0) - (configA?.priority || 0);
    });
    
    for (const { plugin: pluginName, handler } of sorted) {
      const config = this.pluginConfigs.get(pluginName);
      if (!config?.enabled) continue;
      
      try {
        const fullContext = this.createPluginContext(pluginName, context);
        const result = await handler(data, fullContext);
        results.push(result);
      } catch (error) {
        console.error(`Hook ${event} failed for plugin ${pluginName}:`, error);
      }
    }
    
    return results;
  }

  async executeLifecycle(
    method: keyof PlayClonePlugin,
    args: any[],
    context?: Partial<PluginContext>
  ): Promise<void> {
    for (const [pluginName, plugin] of this.plugins.entries()) {
      const config = this.pluginConfigs.get(pluginName);
      if (!config?.enabled) continue;
      
      const lifecycleMethod = plugin[method] as Function;
      if (typeof lifecycleMethod === 'function') {
        try {
          const fullContext = this.createPluginContext(pluginName, context);
          await lifecycleMethod.apply(plugin, [...args, fullContext]);
        } catch (error) {
          console.error(`Lifecycle ${method} failed for plugin ${pluginName}:`, error);
        }
      }
    }
  }

  private createPluginContext(pluginName: string, additional?: Partial<PluginContext>): PluginContext {
    const config = this.pluginConfigs.get(pluginName) || { enabled: true };
    
    return {
      playclone: this.playclone!,
      browser: additional?.browser,
      page: additional?.page,
      config,
      logger: this.createPluginLogger(pluginName),
      storage: this.createPluginStorage(pluginName),
      api: this.createPluginAPI(pluginName),
      ...additional
    };
  }

  private createPluginLogger(pluginName: string): PluginLogger {
    return {
      info: (message: string, ...args: any[]) => {
        console.log(`[${pluginName}] ${message}`, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[${pluginName}] ${message}`, ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[${pluginName}] ${message}`, ...args);
      },
      debug: (message: string, ...args: any[]) => {
        if (process.env.DEBUG) {
          console.debug(`[${pluginName}] ${message}`, ...args);
        }
      }
    };
  }

  private createPluginStorage(pluginName: string): PluginStorage {
    const storageFile = path.join(this.storageDir, `${pluginName}.json`);
    
    const readStorage = async (): Promise<Record<string, any>> => {
      try {
        if (fs.existsSync(storageFile)) {
          const data = await fs.promises.readFile(storageFile, 'utf-8');
          return JSON.parse(data);
        }
      } catch (error) {
        console.error(`Failed to read storage for ${pluginName}:`, error);
      }
      return {};
    };
    
    const writeStorage = async (data: Record<string, any>): Promise<void> => {
      try {
        await fs.promises.writeFile(storageFile, JSON.stringify(data, null, 2));
      } catch (error) {
        console.error(`Failed to write storage for ${pluginName}:`, error);
      }
    };
    
    return {
      get: async (key: string): Promise<any> => {
        const data = await readStorage();
        return data[key];
      },
      set: async (key: string, value: any): Promise<void> => {
        const data = await readStorage();
        data[key] = value;
        await writeStorage(data);
      },
      delete: async (key: string): Promise<void> => {
        const data = await readStorage();
        delete data[key];
        await writeStorage(data);
      },
      clear: async (): Promise<void> => {
        await writeStorage({});
      }
    };
  }

  private createPluginAPI(pluginName: string): PluginAPI {
    return {
      registerCommand: (name: string, handler: CommandHandler) => {
        this.commands.set(name, { plugin: pluginName, handler });
      },
      registerHook: (event: string, handler: HookHandler) => {
        if (!this.hooks.has(event)) {
          this.hooks.set(event, []);
        }
        this.hooks.get(event)!.push({ plugin: pluginName, handler });
      },
      registerSelector: (name: string, handler: SelectorHandler) => {
        this.selectors.set(name, { plugin: pluginName, handler });
      },
      registerExtractor: (name: string, handler: ExtractorHandler) => {
        this.extractors.set(name, { plugin: pluginName, handler });
      },
      emit: (event: string, data?: any) => {
        this.emit(`plugin:${pluginName}:${event}`, data);
      }
    };
  }

  setPlayClone(playclone: PlayClone): void {
    this.playclone = playclone;
  }

  getPlugin(name: string): PlayClonePlugin | undefined {
    return this.plugins.get(name);
  }

  getPlugins(): Map<string, PlayClonePlugin> {
    return new Map(this.plugins);
  }

  getCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  getHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  getSelectors(): string[] {
    return Array.from(this.selectors.keys());
  }

  getExtractors(): string[] {
    return Array.from(this.extractors.keys());
  }

  isPluginEnabled(name: string): boolean {
    const config = this.pluginConfigs.get(name);
    return config?.enabled || false;
  }

  setPluginEnabled(name: string, enabled: boolean): void {
    const config = this.pluginConfigs.get(name);
    if (config) {
      config.enabled = enabled;
    }
  }

  getPluginConfig(name: string): PluginConfig | undefined {
    return this.pluginConfigs.get(name);
  }

  updatePluginConfig(name: string, config: Partial<PluginConfig>): void {
    const existing = this.pluginConfigs.get(name);
    if (existing) {
      this.pluginConfigs.set(name, { ...existing, ...config });
    }
  }
}