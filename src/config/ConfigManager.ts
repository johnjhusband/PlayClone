import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration structure for PlayClone
 */
export interface PlayCloneConfig {
  browser?: {
    defaultBrowser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    viewport?: {
      width?: number;
      height?: number;
    };
    userAgent?: string;
    timeout?: number;
    slowMo?: number;
  };
  
  connectionPool?: {
    enabled?: boolean;
    minSize?: number;
    maxSize?: number;
    idleTimeout?: number;
    preWarm?: boolean;
    preWarmCount?: number;
    reuseStrategy?: 'round-robin' | 'least-used' | 'random';
  };
  
  performance?: {
    cacheEnabled?: boolean;
    cacheSize?: number;
    cacheTTL?: number;
    memoryLimit?: number;
    compressionEnabled?: boolean;
  };
  
  proxy?: {
    server?: string;
    username?: string;
    password?: string;
    bypass?: string[];
  };
  
  ai?: {
    responseOptimization?: boolean;
    maxResponseSize?: number;
    naturalLanguage?: boolean;
    autoRetry?: boolean;
    retryCount?: number;
  };
  
  logging?: {
    level?: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
    console?: boolean;
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: PlayCloneConfig = {
  browser: {
    defaultBrowser: 'chromium',
    headless: false,
    viewport: {
      width: 1280,
      height: 720
    },
    timeout: 30000,
    slowMo: 0
  },
  
  connectionPool: {
    enabled: true,
    minSize: 1,
    maxSize: 5,
    idleTimeout: 300000, // 5 minutes
    preWarm: false,
    preWarmCount: 2,
    reuseStrategy: 'round-robin'
  },
  
  performance: {
    cacheEnabled: true,
    cacheSize: 100,
    cacheTTL: 3600000, // 1 hour
    memoryLimit: 512, // MB
    compressionEnabled: true
  },
  
  ai: {
    responseOptimization: true,
    maxResponseSize: 1024,
    naturalLanguage: true,
    autoRetry: true,
    retryCount: 3
  },
  
  logging: {
    level: 'info',
    console: true
  }
};

/**
 * Configuration manager for PlayClone
 * Handles loading from files, environment variables, and runtime updates
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: PlayCloneConfig;
  private configPath?: string;
  private watchers: Map<string, (config: PlayCloneConfig) => void> = new Map();
  
  private constructor() {
    this.config = this.loadConfiguration();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  /**
   * Load configuration from multiple sources
   * Priority: Environment variables > Config file > Defaults
   */
  private loadConfiguration(): PlayCloneConfig {
    let config = { ...DEFAULT_CONFIG };
    
    // 1. Try to load from config file
    const configFile = this.findConfigFile();
    if (configFile) {
      try {
        const fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        config = this.mergeConfig(config, fileConfig);
        this.configPath = configFile;
        console.log(`Loaded configuration from: ${configFile}`);
      } catch (error) {
        console.warn(`Failed to load config file ${configFile}:`, error);
      }
    }
    
    // 2. Apply environment variable overrides
    config = this.applyEnvironmentOverrides(config);
    
    return config;
  }
  
  /**
   * Find configuration file in current directory or parent directories
   */
  private findConfigFile(): string | null {
    const configNames = [
      'playclone.config.json',
      'playclone.json',
      '.playclonerc.json',
      '.playclonerc'
    ];
    
    let currentDir = process.cwd();
    const root = path.parse(currentDir).root;
    
    while (currentDir !== root) {
      for (const configName of configNames) {
        const configPath = path.join(currentDir, configName);
        if (fs.existsSync(configPath)) {
          return configPath;
        }
      }
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }
  
  /**
   * Deep merge two configuration objects
   */
  private mergeConfig<T extends Record<string, any>>(base: T, override: Partial<T>): T {
    const result = { ...base };
    
    for (const key in override) {
      const baseValue = (base as any)[key];
      const overrideValue = (override as any)[key];
      
      if (overrideValue === undefined) {
        continue;
      }
      
      if (typeof overrideValue === 'object' && !Array.isArray(overrideValue) && overrideValue !== null) {
        (result as any)[key] = this.mergeConfig(
          baseValue || {},
          overrideValue
        );
      } else {
        (result as any)[key] = overrideValue;
      }
    }
    
    return result;
  }
  
  /**
   * Apply environment variable overrides
   * Environment variables follow pattern: PLAYCLONE_<SECTION>_<KEY>
   * Example: PLAYCLONE_BROWSER_HEADLESS=true
   */
  private applyEnvironmentOverrides(config: PlayCloneConfig): PlayCloneConfig {
    const result = { ...config };
    
    // Browser settings
    if (process.env.PLAYCLONE_BROWSER_HEADLESS !== undefined) {
      result.browser = result.browser || {};
      result.browser.headless = process.env.PLAYCLONE_BROWSER_HEADLESS === 'true';
    }
    
    if (process.env.PLAYCLONE_BROWSER_DEFAULT) {
      result.browser = result.browser || {};
      result.browser.defaultBrowser = process.env.PLAYCLONE_BROWSER_DEFAULT as any;
    }
    
    if (process.env.PLAYCLONE_BROWSER_TIMEOUT) {
      result.browser = result.browser || {};
      result.browser.timeout = parseInt(process.env.PLAYCLONE_BROWSER_TIMEOUT);
    }
    
    // Connection pool settings
    if (process.env.PLAYCLONE_POOL_ENABLED !== undefined) {
      result.connectionPool = result.connectionPool || {};
      result.connectionPool.enabled = process.env.PLAYCLONE_POOL_ENABLED === 'true';
    }
    
    if (process.env.PLAYCLONE_POOL_MIN_SIZE) {
      result.connectionPool = result.connectionPool || {};
      result.connectionPool.minSize = parseInt(process.env.PLAYCLONE_POOL_MIN_SIZE);
    }
    
    if (process.env.PLAYCLONE_POOL_MAX_SIZE) {
      result.connectionPool = result.connectionPool || {};
      result.connectionPool.maxSize = parseInt(process.env.PLAYCLONE_POOL_MAX_SIZE);
    }
    
    if (process.env.PLAYCLONE_POOL_PREWARM !== undefined) {
      result.connectionPool = result.connectionPool || {};
      result.connectionPool.preWarm = process.env.PLAYCLONE_POOL_PREWARM === 'true';
    }
    
    if (process.env.PLAYCLONE_POOL_PREWARM_COUNT) {
      result.connectionPool = result.connectionPool || {};
      result.connectionPool.preWarmCount = parseInt(process.env.PLAYCLONE_POOL_PREWARM_COUNT);
    }
    
    // Proxy settings
    if (process.env.PLAYCLONE_PROXY_SERVER) {
      result.proxy = result.proxy || {};
      result.proxy.server = process.env.PLAYCLONE_PROXY_SERVER;
    }
    
    if (process.env.PLAYCLONE_PROXY_USERNAME) {
      result.proxy = result.proxy || {};
      result.proxy.username = process.env.PLAYCLONE_PROXY_USERNAME;
    }
    
    if (process.env.PLAYCLONE_PROXY_PASSWORD) {
      result.proxy = result.proxy || {};
      result.proxy.password = process.env.PLAYCLONE_PROXY_PASSWORD;
    }
    
    // AI settings
    if (process.env.PLAYCLONE_AI_RESPONSE_OPTIMIZATION !== undefined) {
      result.ai = result.ai || {};
      result.ai.responseOptimization = process.env.PLAYCLONE_AI_RESPONSE_OPTIMIZATION === 'true';
    }
    
    if (process.env.PLAYCLONE_AI_MAX_RESPONSE_SIZE) {
      result.ai = result.ai || {};
      result.ai.maxResponseSize = parseInt(process.env.PLAYCLONE_AI_MAX_RESPONSE_SIZE);
    }
    
    // Logging settings
    if (process.env.PLAYCLONE_LOG_LEVEL) {
      result.logging = result.logging || {};
      result.logging.level = process.env.PLAYCLONE_LOG_LEVEL as any;
    }
    
    return result;
  }
  
  /**
   * Get current configuration
   */
  getConfig(): PlayCloneConfig {
    return { ...this.config };
  }
  
  /**
   * Get specific configuration section
   */
  get<K extends keyof PlayCloneConfig>(section: K): PlayCloneConfig[K] {
    return this.config[section];
  }
  
  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<PlayCloneConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.notifyWatchers();
  }
  
  /**
   * Update specific configuration section
   */
  updateSection<K extends keyof PlayCloneConfig>(
    section: K,
    updates: Partial<PlayCloneConfig[K]>
  ): void {
    this.config[section] = this.mergeConfig(
      this.config[section] || {},
      updates
    ) as PlayCloneConfig[K];
    this.notifyWatchers();
  }
  
  /**
   * Save current configuration to file
   */
  saveConfig(filePath?: string): void {
    const savePath = filePath || this.configPath || path.join(process.cwd(), 'playclone.config.json');
    fs.writeFileSync(savePath, JSON.stringify(this.config, null, 2));
    console.log(`Configuration saved to: ${savePath}`);
  }
  
  /**
   * Reload configuration from file
   */
  reloadConfig(): void {
    this.config = this.loadConfiguration();
    this.notifyWatchers();
  }
  
  /**
   * Watch for configuration changes
   */
  watch(id: string, callback: (config: PlayCloneConfig) => void): void {
    this.watchers.set(id, callback);
  }
  
  /**
   * Stop watching configuration changes
   */
  unwatch(id: string): void {
    this.watchers.delete(id);
  }
  
  /**
   * Notify all watchers of configuration changes
   */
  private notifyWatchers(): void {
    for (const callback of this.watchers.values()) {
      callback(this.config);
    }
  }
  
  /**
   * Validate configuration
   */
  validateConfig(config: Partial<PlayCloneConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate browser settings
    if (config.browser) {
      if (config.browser.defaultBrowser && 
          !['chromium', 'firefox', 'webkit'].includes(config.browser.defaultBrowser)) {
        errors.push(`Invalid browser: ${config.browser.defaultBrowser}`);
      }
      
      if (config.browser.timeout && config.browser.timeout < 0) {
        errors.push('Browser timeout must be positive');
      }
    }
    
    // Validate connection pool settings
    if (config.connectionPool) {
      const pool = config.connectionPool;
      
      if (pool.minSize !== undefined && pool.minSize < 0) {
        errors.push('Pool minSize must be non-negative');
      }
      
      if (pool.maxSize !== undefined && pool.maxSize < 1) {
        errors.push('Pool maxSize must be at least 1');
      }
      
      if (pool.minSize !== undefined && pool.maxSize !== undefined && 
          pool.minSize > pool.maxSize) {
        errors.push('Pool minSize cannot exceed maxSize');
      }
      
      if (pool.reuseStrategy && 
          !['round-robin', 'least-used', 'random'].includes(pool.reuseStrategy)) {
        errors.push(`Invalid reuse strategy: ${pool.reuseStrategy}`);
      }
    }
    
    // Validate performance settings
    if (config.performance) {
      if (config.performance.memoryLimit && config.performance.memoryLimit < 1) {
        errors.push('Memory limit must be at least 1 MB');
      }
      
      if (config.performance.cacheSize && config.performance.cacheSize < 0) {
        errors.push('Cache size must be non-negative');
      }
    }
    
    // Validate AI settings
    if (config.ai) {
      if (config.ai.maxResponseSize && config.ai.maxResponseSize < 1) {
        errors.push('Max response size must be at least 1 byte');
      }
      
      if (config.ai.retryCount !== undefined && config.ai.retryCount < 0) {
        errors.push('Retry count must be non-negative');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Export configuration as JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }
  
  /**
   * Import configuration from JSON string
   */
  fromJSON(json: string): void {
    try {
      const parsed = JSON.parse(json);
      const validation = this.validateConfig(parsed);
      
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }
      
      this.config = this.mergeConfig(DEFAULT_CONFIG, parsed);
      this.notifyWatchers();
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error}`);
    }
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();