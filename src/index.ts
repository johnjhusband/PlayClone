/**
 * PlayClone - AI-Native Browser Automation Framework
 * Main entry point for the PlayClone library
 */

// Export main PlayClone class
export { PlayClone } from './PlayClone';
export { default } from './PlayClone';

// Export core components
export { BrowserManager } from './core/BrowserManager';
export { SessionManager } from './core/SessionManager';
export { PlayCloneContext } from './core/PlayCloneContext';
export { CookieManager } from './core/CookieManager';
export { ExtensionManager } from './core/ExtensionManager';
export { ElementLocator } from './selectors/ElementLocator';
export { ActionExecutor } from './actions/ActionExecutor';
export { DataExtractor } from './extractors/DataExtractor';
export { StateManager } from './state/StateManager';
export * from './types';
export * from './utils/responseFormatter';

// Export error handling utilities
export * from './utils/errors';
export { withRetry, RetryStrategies, CircuitBreaker, RetryOptions } from './utils/retry';
export { withDegradation, DefaultStrategies as DegradationStrategies, FallbackChain } from './utils/degradation';
export { TimeoutManager, AdaptiveTimeout, withTimeout, DEFAULT_TIMEOUTS } from './utils/timeout';
export { BrowserRecoveryManager, CrashDetector, RecoveryStrategies } from './utils/recovery';
export { AIErrorReporter, ErrorPatternMatcher, type AIErrorReport } from './utils/errorReporter';

// Export optimization utilities
export { BrowserPrewarmer, getGlobalPrewarmer, startGlobalPrewarming, stopGlobalPrewarming } from './optimization/BrowserPrewarmer';
export { ConnectionPool, getGlobalPool, closeGlobalPool, type PoolConfig, type PoolStats } from './optimization/ConnectionPool';
export { PoolConfigManager, getPoolConfig, getConnectionPoolConfig, type ExtendedPoolConfig } from './config/PoolConfigManager';

// Export configuration management
export { ConfigManager, configManager, type PlayCloneConfig } from './config/ConfigManager';

// Export plugin system
export { PluginManager } from './plugins/PluginManager';
export { BasePlugin } from './plugins/BasePlugin';
export type {
  PlayClonePlugin,
  PluginMetadata,
  PluginContext,
  PluginConfig,
  PluginLogger,
  PluginStorage,
  PluginAPI,
  CommandHandler,
  HookHandler,
  SelectorHandler,
  ExtractorHandler
} from './plugins/PluginManager';

// Re-export PlayCloneOptions from types
export type { LaunchOptions as PlayCloneOptions } from './types';