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
export { TabManager, TabInfo, TabResult } from './core/TabManager';
export { DownloadManager, DownloadOptions, DownloadResult, DownloadProgress } from './browser/DownloadManager';
export { FileUploadManager, FileUploadOptions, DragDropUploadResult } from './browser/FileUploadManager';
export { GeolocationManager, GeolocationOptions, GeolocationCoordinates, LocationPreset } from './browser/GeolocationManager';
export { DeviceEmulator, DeviceProfile, ViewportConfig, DEVICE_PROFILES, DEVICE_CATEGORIES } from './browser/DeviceEmulator';
export { NetworkInterceptor, InterceptedRequest, InterceptedResponse, RequestMatcher, RequestModification, ResponseModification, ThrottlingProfile, THROTTLING_PROFILES } from './browser/NetworkInterceptor';
export { WebSocketInterceptor, WebSocketFrame, WebSocketConnection, WebSocketDirection, WebSocketFrameType, WebSocketState, FrameHandler, FrameModifier, ConnectionHandler } from './browser/WebSocketInterceptor';
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

// Export data extraction templates
export { DataExtractionTemplates, BuiltInTemplates, type ExtractionTemplate, type TemplateField, type ExtractionResult } from './extraction/DataExtractionTemplates';
export { TableDetector, type TableData, type TableDetectionResult, type TableExtractionOptions } from './extraction/TableDetector';
export { PdfGenerator, type PdfGenerationOptions, type PdfResult, type PdfSaveResult } from './extraction/PdfGenerator';

// Export data validation and sanitization
export { DataValidator, type ValidationRule, type FieldValidation, type ValidationResult, type SanitizationOptions } from './data/DataValidator';

// Export data export utilities
export { DataExporter } from './data/DataExporter';

// Export data transformation pipelines
export { 
  DataTransformationPipeline,
  PipelineBuilder,
  type TransformStep,
  type Pipeline,
  type TransformResult
} from './data/DataTransformationPipeline';

// Export analytics and reporting
export {
  AnalyticsDashboard,
  MetricsCollector,
  type DashboardConfig,
  type SessionMetrics,
  type ActionMetric,
  type ErrorMetric,
  type PerformanceMetric,
  type DataMetric,
  type AggregatedMetrics
} from './analytics/AnalyticsDashboard';

// Export cloud integration
export {
  CloudIntegrationManager,
  CloudProvider,
  AWSProvider,
  GCPProvider,
  AzureProvider,
  CloudConfig,
  DeploymentConfig,
  DeploymentStatus,
  CostEstimate
} from './cloud';

// Export security components
export { CredentialManager } from './security/CredentialManager';
export { AuditLogger, AuditEventType, AuditSeverity } from './security/AuditLogger';

// Export distributed browser farm
export { BrowserFarm } from './farm/BrowserFarm';
export { BrowserFarmClient } from './farm/BrowserFarmClient';
export type { BrowserWorker, WorkerSession, WorkerMetrics, FarmConfig, WorkerConfig } from './farm/BrowserFarm';
export type { FarmClientConfig, SessionOptions } from './farm/BrowserFarmClient';

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

// Export AI Enhancement Features
export { VisualElementDetector } from './ai/VisualElementDetector';
export { IntelligentWaitStrategies } from './ai/IntelligentWaitStrategies';
export { SmartFormFiller } from './ai/SmartFormFiller';
export { CaptchaDetector } from './ai/CaptchaDetector';
export { PaginationHandler, type PaginationOptions, type PaginationInfo, type PaginationResult } from './ai/PaginationHandler';
export { InfiniteScrollHandler, type InfiniteScrollOptions, type ScrollDetectionResult, type ScrollProgress, type InfiniteScrollResult } from './ai/InfiniteScrollHandler';
export { SelfHealingSelectors } from './ai/SelfHealingSelectors';
export { PageChangeDetector } from './ai/PageChangeDetector';

// Export Developer Tools
export { VisualSelectorBuilder, type SelectorBuilderOptions, type ElementInfo } from './devtools/VisualSelectorBuilder';
export { LivePreview, type LivePreviewOptions, type PreviewEvent } from './devtools/LivePreview';
export { StepDebugger, type DebuggerOptions, type DebugStep, type Breakpoint, type WatchExpression, type PerformanceProfile } from './devtools/StepDebugger';
export { TestScenarioGenerator, type TestScenario, type TestStep, type TestAssertion, type GeneratorOptions } from './devtools/TestScenarioGenerator';
export { PerformanceProfiler, PerformanceMonitor, type PerformanceMetrics, type ProfilerOptions, type ProfileReport, type Bottleneck } from './devtools/PerformanceProfiler';
export { BrowserRecorder, type RecorderOptions, type RecordedStep } from './recorder/BrowserRecorder';
// export { CDPIntegration, type CDPOptions, type CDPEvent } from './devtools/CDPIntegration';

// Re-export PlayCloneOptions from types
export type { LaunchOptions as PlayCloneOptions } from './types';

// Export Selenium WebDriver compatibility layer
export { 
  SeleniumWebDriver,
  WebElement,
  By,
  Keys,
  WebDriverWait,
  ExpectedConditions,
  createWebDriver,
  default as WebDriver
} from './compatibility/SeleniumWebDriverCompatibility';

// Export Cypress compatibility layer
export {
  CypressCommands,
  CypressTestRunner,
  cy,
  default as Cypress
} from './compatibility/CypressCompatibility';

// Export REST API and GraphQL servers
export { RestApiServer } from './server/RestApiServer';
// export { GraphQLApiServer } from './server/GraphQLApiServer';

// Export WebDriver BiDi protocol
export { WebDriverBiDi, createBiDiServer } from './compatibility/WebDriverBiDi';

// Export Workflow Orchestration
export {
  WorkflowOrchestrator,
  type Workflow,
  type WorkflowStep,
  type WorkflowCondition,
  type WorkflowLoop,
  type WorkflowParallel,
  type WorkflowApproval,
  type WorkflowWebhook,
  type WorkflowTrigger,
  type WorkflowExecution,
  type ExecutionHistoryItem,
  type RetryPolicy
} from './orchestration/WorkflowOrchestrator';

export { WorkflowBuilder } from './orchestration/WorkflowBuilder';
export { WorkflowTemplates } from './orchestration/WorkflowTemplates';