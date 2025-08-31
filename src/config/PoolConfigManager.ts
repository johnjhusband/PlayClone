/**
 * Connection Pool Configuration Manager
 * Manages pool configuration from multiple sources (env vars, config files, runtime)
 */

import { PoolConfig } from '../optimization/ConnectionPool';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Extended pool configuration with additional settings
 */
export interface ExtendedPoolConfig extends PoolConfig {
  enabled: boolean;
  preWarmBrowsers: boolean;
  browserPreWarmCount: number;
  adaptiveScaling: boolean;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  metricsEnabled: boolean;
  metricsInterval: number;
}

/**
 * Configuration source priority (higher number = higher priority)
 */
export enum ConfigPriority {
  DEFAULTS = 0,
  CONFIG_FILE = 1,
  ENVIRONMENT = 2,
  RUNTIME = 3
}

/**
 * Pool Configuration Manager
 */
export class PoolConfigManager {
  private static instance: PoolConfigManager;
  private config: ExtendedPoolConfig;
  private configSources: Map<ConfigPriority, Partial<ExtendedPoolConfig>>;

  private constructor() {
    this.configSources = new Map();
    this.config = this.getDefaultConfig();
    this.loadConfigurations();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PoolConfigManager {
    if (!PoolConfigManager.instance) {
      PoolConfigManager.instance = new PoolConfigManager();
    }
    return PoolConfigManager.instance;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): ExtendedPoolConfig {
    return {
      // Standard pool settings
      minConnections: 2,
      maxConnections: 10,
      maxIdleTime: 30000,
      maxLifetime: 300000,
      maxRequestsPerConnection: 100,
      connectionTimeout: 10000,
      recycleOnError: true,
      warmupOnStart: true,
      
      // Extended settings
      enabled: true,
      preWarmBrowsers: false,
      browserPreWarmCount: 2,
      adaptiveScaling: false,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.2,
      metricsEnabled: false,
      metricsInterval: 60000
    };
  }

  /**
   * Load configurations from all sources
   */
  private loadConfigurations(): void {
    // Set defaults
    this.configSources.set(ConfigPriority.DEFAULTS, this.getDefaultConfig());
    
    // Load from config file
    this.loadConfigFile();
    
    // Load from environment variables
    this.loadEnvironmentConfig();
    
    // Merge all configurations
    this.mergeConfigurations();
  }

  /**
   * Load configuration from file
   */
  private loadConfigFile(): void {
    const configPaths = [
      path.join(process.cwd(), 'playclone.config.json'),
      path.join(process.cwd(), '.playclone', 'pool.config.json'),
      path.join(process.env.HOME || '', '.playclone', 'config.json')
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const fileContent = fs.readFileSync(configPath, 'utf-8');
          const fileConfig = JSON.parse(fileContent);
          
          if (fileConfig.pool) {
            this.configSources.set(ConfigPriority.CONFIG_FILE, fileConfig.pool);
            console.log(`Loaded pool configuration from ${configPath}`);
            break;
          }
        } catch (error) {
          console.error(`Error loading config from ${configPath}:`, error);
        }
      }
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvironmentConfig(): void {
    const envConfig: Partial<ExtendedPoolConfig> = {};
    
    // Standard pool settings
    if (process.env.PLAYCLONE_POOL_MIN_CONNECTIONS) {
      envConfig.minConnections = parseInt(process.env.PLAYCLONE_POOL_MIN_CONNECTIONS, 10);
    }
    if (process.env.PLAYCLONE_POOL_MAX_CONNECTIONS) {
      envConfig.maxConnections = parseInt(process.env.PLAYCLONE_POOL_MAX_CONNECTIONS, 10);
    }
    if (process.env.PLAYCLONE_POOL_MAX_IDLE_TIME) {
      envConfig.maxIdleTime = parseInt(process.env.PLAYCLONE_POOL_MAX_IDLE_TIME, 10);
    }
    if (process.env.PLAYCLONE_POOL_MAX_LIFETIME) {
      envConfig.maxLifetime = parseInt(process.env.PLAYCLONE_POOL_MAX_LIFETIME, 10);
    }
    if (process.env.PLAYCLONE_POOL_MAX_REQUESTS) {
      envConfig.maxRequestsPerConnection = parseInt(process.env.PLAYCLONE_POOL_MAX_REQUESTS, 10);
    }
    if (process.env.PLAYCLONE_POOL_CONNECTION_TIMEOUT) {
      envConfig.connectionTimeout = parseInt(process.env.PLAYCLONE_POOL_CONNECTION_TIMEOUT, 10);
    }
    if (process.env.PLAYCLONE_POOL_RECYCLE_ON_ERROR !== undefined) {
      envConfig.recycleOnError = process.env.PLAYCLONE_POOL_RECYCLE_ON_ERROR === 'true';
    }
    if (process.env.PLAYCLONE_POOL_WARMUP !== undefined) {
      envConfig.warmupOnStart = process.env.PLAYCLONE_POOL_WARMUP === 'true';
    }
    
    // Extended settings
    if (process.env.PLAYCLONE_POOL_ENABLED !== undefined) {
      envConfig.enabled = process.env.PLAYCLONE_POOL_ENABLED === 'true';
    }
    if (process.env.PLAYCLONE_POOL_PRE_WARM !== undefined) {
      envConfig.preWarmBrowsers = process.env.PLAYCLONE_POOL_PRE_WARM === 'true';
    }
    if (process.env.PLAYCLONE_POOL_PRE_WARM_COUNT) {
      envConfig.browserPreWarmCount = parseInt(process.env.PLAYCLONE_POOL_PRE_WARM_COUNT, 10);
    }
    if (process.env.PLAYCLONE_POOL_ADAPTIVE_SCALING !== undefined) {
      envConfig.adaptiveScaling = process.env.PLAYCLONE_POOL_ADAPTIVE_SCALING === 'true';
    }
    if (process.env.PLAYCLONE_POOL_SCALE_UP_THRESHOLD) {
      envConfig.scaleUpThreshold = parseFloat(process.env.PLAYCLONE_POOL_SCALE_UP_THRESHOLD);
    }
    if (process.env.PLAYCLONE_POOL_SCALE_DOWN_THRESHOLD) {
      envConfig.scaleDownThreshold = parseFloat(process.env.PLAYCLONE_POOL_SCALE_DOWN_THRESHOLD);
    }
    if (process.env.PLAYCLONE_POOL_METRICS !== undefined) {
      envConfig.metricsEnabled = process.env.PLAYCLONE_POOL_METRICS === 'true';
    }
    if (process.env.PLAYCLONE_POOL_METRICS_INTERVAL) {
      envConfig.metricsInterval = parseInt(process.env.PLAYCLONE_POOL_METRICS_INTERVAL, 10);
    }
    
    if (Object.keys(envConfig).length > 0) {
      this.configSources.set(ConfigPriority.ENVIRONMENT, envConfig);
    }
  }

  /**
   * Merge configurations based on priority
   */
  private mergeConfigurations(): void {
    // Start with defaults
    this.config = { ...this.getDefaultConfig() };
    
    // Apply configurations in priority order
    const priorities = [
      ConfigPriority.DEFAULTS,
      ConfigPriority.CONFIG_FILE,
      ConfigPriority.ENVIRONMENT,
      ConfigPriority.RUNTIME
    ];
    
    for (const priority of priorities) {
      const sourceConfig = this.configSources.get(priority);
      if (sourceConfig) {
        this.config = { ...this.config, ...sourceConfig };
      }
    }
    
    // Validate configuration
    this.validateConfig();
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    // Ensure min <= max connections
    if (this.config.minConnections > this.config.maxConnections) {
      console.warn('minConnections > maxConnections, adjusting minConnections');
      this.config.minConnections = this.config.maxConnections;
    }
    
    // Ensure positive values
    if (this.config.minConnections < 0) this.config.minConnections = 0;
    if (this.config.maxConnections < 1) this.config.maxConnections = 1;
    if (this.config.maxIdleTime < 1000) this.config.maxIdleTime = 1000;
    if (this.config.maxLifetime < 10000) this.config.maxLifetime = 10000;
    if (this.config.connectionTimeout < 1000) this.config.connectionTimeout = 1000;
    
    // Validate thresholds
    if (this.config.scaleUpThreshold < 0 || this.config.scaleUpThreshold > 1) {
      this.config.scaleUpThreshold = 0.8;
    }
    if (this.config.scaleDownThreshold < 0 || this.config.scaleDownThreshold > 1) {
      this.config.scaleDownThreshold = 0.2;
    }
    
    // Pre-warm count should not exceed max connections
    if (this.config.browserPreWarmCount > this.config.maxConnections) {
      this.config.browserPreWarmCount = this.config.maxConnections;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ExtendedPoolConfig {
    return { ...this.config };
  }

  /**
   * Get pool-specific configuration
   */
  getPoolConfig(): PoolConfig {
    return {
      minConnections: this.config.minConnections,
      maxConnections: this.config.maxConnections,
      maxIdleTime: this.config.maxIdleTime,
      maxLifetime: this.config.maxLifetime,
      maxRequestsPerConnection: this.config.maxRequestsPerConnection,
      connectionTimeout: this.config.connectionTimeout,
      recycleOnError: this.config.recycleOnError,
      warmupOnStart: this.config.warmupOnStart
    };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<ExtendedPoolConfig>): void {
    this.configSources.set(ConfigPriority.RUNTIME, updates);
    this.mergeConfigurations();
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    this.configSources.clear();
    this.config = this.getDefaultConfig();
    this.loadConfigurations();
  }

  /**
   * Save current configuration to file
   */
  saveConfigToFile(filePath?: string): void {
    const targetPath = filePath || path.join(process.cwd(), 'playclone.config.json');
    
    const configData = {
      pool: this.config,
      _comment: 'PlayClone connection pool configuration',
      _generated: new Date().toISOString()
    };
    
    try {
      fs.writeFileSync(targetPath, JSON.stringify(configData, null, 2));
      console.log(`Configuration saved to ${targetPath}`);
    } catch (error) {
      console.error(`Error saving configuration to ${targetPath}:`, error);
    }
  }

  /**
   * Get configuration summary for logging
   */
  getConfigSummary(): string {
    return `Pool Configuration:
  - Enabled: ${this.config.enabled}
  - Connections: ${this.config.minConnections}-${this.config.maxConnections}
  - Max Idle Time: ${this.config.maxIdleTime}ms
  - Max Lifetime: ${this.config.maxLifetime}ms
  - Max Requests/Connection: ${this.config.maxRequestsPerConnection}
  - Connection Timeout: ${this.config.connectionTimeout}ms
  - Recycle on Error: ${this.config.recycleOnError}
  - Warmup on Start: ${this.config.warmupOnStart}
  - Pre-warm Browsers: ${this.config.preWarmBrowsers} (${this.config.browserPreWarmCount})
  - Adaptive Scaling: ${this.config.adaptiveScaling}
  - Metrics: ${this.config.metricsEnabled}`;
  }

  /**
   * Check if pool is enabled
   */
  isPoolEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get adaptive scaling settings
   */
  getScalingSettings(): {
    enabled: boolean;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
  } {
    return {
      enabled: this.config.adaptiveScaling,
      scaleUpThreshold: this.config.scaleUpThreshold,
      scaleDownThreshold: this.config.scaleDownThreshold
    };
  }
}

/**
 * Export convenience function
 */
export function getPoolConfig(): ExtendedPoolConfig {
  return PoolConfigManager.getInstance().getConfig();
}

/**
 * Export convenience function for pool-specific config
 */
export function getConnectionPoolConfig(): PoolConfig {
  return PoolConfigManager.getInstance().getPoolConfig();
}