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

// Re-export PlayCloneOptions from types
export type { LaunchOptions as PlayCloneOptions } from './types';