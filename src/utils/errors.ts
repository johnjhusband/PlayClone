/**
 * Comprehensive error types for PlayClone
 * Provides detailed error information for AI assistants
 */

/**
 * Base error class for all PlayClone errors
 */
export class PlayCloneError extends Error {
  public readonly code: string;
  public readonly action?: string;
  public readonly selector?: string;
  public readonly url?: string;
  public readonly details?: any;
  public readonly retryable: boolean;
  public readonly suggestion?: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    options?: {
      action?: string;
      selector?: string;
      url?: string;
      details?: any;
      retryable?: boolean;
      suggestion?: string;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.action = options?.action;
    this.selector = options?.selector;
    this.url = options?.url;
    this.details = options?.details;
    this.retryable = options?.retryable ?? false;
    this.suggestion = options?.suggestion;
    
    if (options?.cause) {
      this.cause = options.cause;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      action: this.action,
      selector: this.selector,
      url: this.url,
      details: this.details,
      retryable: this.retryable,
      suggestion: this.suggestion,
      stack: this.stack,
    };
  }
}

/**
 * Browser-related errors
 */
export class BrowserError extends PlayCloneError {
  constructor(message: string, options?: any) {
    super(message, 'BROWSER_ERROR', {
      ...options,
      retryable: true,
      suggestion: 'Try relaunching the browser or checking browser settings',
    });
  }
}

export class BrowserLaunchError extends BrowserError {
  constructor(message: string, options?: any) {
    super(message, {
      ...options,
      code: 'BROWSER_LAUNCH_ERROR',
      suggestion: 'Ensure browser binaries are installed: npx playwright install',
    });
  }
}

export class BrowserCrashError extends BrowserError {
  constructor(message: string, options?: any) {
    super(message, {
      ...options,
      code: 'BROWSER_CRASH_ERROR',
      retryable: true,
      suggestion: 'Browser crashed unexpectedly. Try reducing memory usage or restarting',
    });
  }
}

export class BrowserContextError extends BrowserError {
  constructor(message: string, options?: any) {
    super(message, {
      ...options,
      code: 'BROWSER_CONTEXT_ERROR',
      suggestion: 'Browser context is invalid. Try creating a new context',
    });
  }
}

/**
 * Navigation errors
 */
export class NavigationError extends PlayCloneError {
  constructor(message: string, options?: any) {
    super(message, 'NAVIGATION_ERROR', {
      ...options,
      retryable: true,
      suggestion: 'Check the URL and network connection',
    });
  }
}

export class NavigationTimeoutError extends NavigationError {
  constructor(url: string, timeout: number, options?: any) {
    super(`Navigation to ${url} timed out after ${timeout}ms`, {
      ...options,
      code: 'NAVIGATION_TIMEOUT',
      url,
      details: { timeout },
      suggestion: 'Increase timeout or check if the page is responsive',
    });
  }
}

export class NetworkError extends NavigationError {
  constructor(message: string, options?: any) {
    super(message, {
      ...options,
      code: 'NETWORK_ERROR',
      retryable: true,
      suggestion: 'Check network connection and try again',
    });
  }
}

export class SSLError extends NavigationError {
  constructor(url: string, options?: any) {
    super(`SSL certificate error for ${url}`, {
      ...options,
      code: 'SSL_ERROR',
      url,
      retryable: false,
      suggestion: 'The site has SSL certificate issues. Consider using ignoreHTTPSErrors option',
    });
  }
}

/**
 * Element-related errors
 */
export class ElementError extends PlayCloneError {
  constructor(message: string, options?: any) {
    super(message, 'ELEMENT_ERROR', {
      ...options,
      retryable: true,
      suggestion: 'Check if the element exists and is visible on the page',
    });
  }
}

export class ElementNotFoundError extends ElementError {
  constructor(selector: string, options?: any) {
    super(`Element not found: ${selector}`, {
      ...options,
      code: 'ELEMENT_NOT_FOUND',
      selector,
      suggestion: `Try a different selector or wait for the element to appear. Selector: "${selector}"`,
    });
  }
}

export class ElementNotVisibleError extends ElementError {
  constructor(selector: string, options?: any) {
    super(`Element is not visible: ${selector}`, {
      ...options,
      code: 'ELEMENT_NOT_VISIBLE',
      selector,
      suggestion: 'Element exists but is hidden. Try scrolling or checking display properties',
    });
  }
}

export class ElementNotInteractableError extends ElementError {
  constructor(selector: string, reason?: string, options?: any) {
    super(`Element is not interactable: ${selector}${reason ? `. ${reason}` : ''}`, {
      ...options,
      code: 'ELEMENT_NOT_INTERACTABLE',
      selector,
      suggestion: 'Element might be disabled, covered by another element, or not ready for interaction',
    });
  }
}

export class ElementStaleError extends ElementError {
  constructor(selector: string, options?: any) {
    super(`Element is stale (no longer in DOM): ${selector}`, {
      ...options,
      code: 'ELEMENT_STALE',
      selector,
      retryable: true,
      suggestion: 'Element was removed from DOM. Try re-locating the element',
    });
  }
}

export class MultipleElementsError extends ElementError {
  constructor(selector: string, count: number, options?: any) {
    super(`Multiple elements found (${count}) for selector: ${selector}`, {
      ...options,
      code: 'MULTIPLE_ELEMENTS',
      selector,
      details: { count },
      suggestion: 'Use a more specific selector or index to target a single element',
    });
  }
}

/**
 * Action-related errors
 */
export class ActionError extends PlayCloneError {
  constructor(message: string, options?: any) {
    super(message, 'ACTION_ERROR', {
      ...options,
      retryable: true,
      suggestion: 'Check if the action is valid for this element type',
    });
  }
}

export class ClickError extends ActionError {
  constructor(selector: string, reason?: string, options?: any) {
    super(`Failed to click element: ${selector}${reason ? `. ${reason}` : ''}`, {
      ...options,
      code: 'CLICK_ERROR',
      action: 'click',
      selector,
      suggestion: 'Ensure element is clickable and not covered by other elements',
    });
  }
}

export class FillError extends ActionError {
  constructor(selector: string, reason?: string, options?: any) {
    super(`Failed to fill element: ${selector}${reason ? `. ${reason}` : ''}`, {
      ...options,
      code: 'FILL_ERROR',
      action: 'fill',
      selector,
      suggestion: 'Ensure element is an input field and is editable',
    });
  }
}

export class SelectError extends ActionError {
  constructor(selector: string, value: string, options?: any) {
    super(`Failed to select option "${value}" in: ${selector}`, {
      ...options,
      code: 'SELECT_ERROR',
      action: 'select',
      selector,
      details: { value },
      suggestion: 'Check if the option exists in the dropdown',
    });
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends PlayCloneError {
  constructor(message: string, timeout: number, options?: any) {
    super(`${message} (timeout: ${timeout}ms)`, 'TIMEOUT_ERROR', {
      ...options,
      details: { timeout },
      retryable: true,
      suggestion: 'Increase timeout or check if the operation is stuck',
    });
  }
}

export class WaitTimeoutError extends TimeoutError {
  constructor(condition: string, timeout: number, options?: any) {
    super(`Waiting for ${condition}`, timeout, {
      ...options,
      code: 'WAIT_TIMEOUT',
      suggestion: `Condition "${condition}" was not met within ${timeout}ms`,
    });
  }
}

/**
 * State management errors
 */
export class StateError extends PlayCloneError {
  constructor(message: string, options?: any) {
    super(message, 'STATE_ERROR', {
      ...options,
      retryable: false,
      suggestion: 'Check state management configuration',
    });
  }
}

export class CheckpointNotFoundError extends StateError {
  constructor(name: string, options?: any) {
    super(`Checkpoint not found: ${name}`, {
      ...options,
      code: 'CHECKPOINT_NOT_FOUND',
      details: { checkpointName: name },
      suggestion: 'Use listCheckpoints() to see available checkpoints',
    });
  }
}

export class StateSerializationError extends StateError {
  constructor(reason: string, options?: any) {
    super(`Failed to serialize state: ${reason}`, {
      ...options,
      code: 'STATE_SERIALIZATION_ERROR',
      suggestion: 'Some state data may not be serializable',
    });
  }
}

/**
 * Session errors
 */
export class SessionError extends PlayCloneError {
  constructor(message: string, options?: any) {
    super(message, 'SESSION_ERROR', {
      ...options,
      retryable: false,
      suggestion: 'Try creating a new session',
    });
  }
}

export class SessionExpiredError extends SessionError {
  constructor(sessionId: string, options?: any) {
    super(`Session expired: ${sessionId}`, {
      ...options,
      code: 'SESSION_EXPIRED',
      details: { sessionId },
      suggestion: 'Session has expired. Create a new session to continue',
    });
  }
}

/**
 * Validation errors
 */
export class ValidationError extends PlayCloneError {
  constructor(message: string, options?: any) {
    super(message, 'VALIDATION_ERROR', {
      ...options,
      retryable: false,
      suggestion: 'Check input parameters',
    });
  }
}

export class InvalidSelectorError extends ValidationError {
  constructor(selector: string, reason?: string, options?: any) {
    super(`Invalid selector: ${selector}${reason ? `. ${reason}` : ''}`, {
      ...options,
      code: 'INVALID_SELECTOR',
      selector,
      suggestion: 'Check selector syntax',
    });
  }
}

export class InvalidURLError extends ValidationError {
  constructor(url: string, options?: any) {
    super(`Invalid URL: ${url}`, {
      ...options,
      code: 'INVALID_URL',
      url,
      suggestion: 'Ensure URL is properly formatted (e.g., https://example.com)',
    });
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends PlayCloneError {
  constructor(message: string, options?: any) {
    super(message, 'CONFIGURATION_ERROR', {
      ...options,
      retryable: false,
      suggestion: 'Check PlayClone configuration',
    });
  }
}

/**
 * Error helper functions
 */

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof PlayCloneError) {
    return error.retryable;
  }
  
  // Check for common retryable error patterns
  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /connection/i,
    /temporarily/i,
    /ECONNREFUSED/,
    /ETIMEDOUT/,
    /ENOTFOUND/,
  ];
  
  const message = error?.message || error?.toString() || '';
  return retryablePatterns.some(pattern => pattern.test(message));
}

/**
 * Convert unknown error to PlayCloneError
 */
export function normalizeError(error: any, context?: {
  action?: string;
  selector?: string;
  url?: string;
}): PlayCloneError {
  // If already a PlayCloneError, return as-is
  if (error instanceof PlayCloneError) {
    return error;
  }

  // Convert common Playwright errors
  const message = error?.message || error?.toString() || 'Unknown error';
  
  // Timeout errors
  if (message.includes('Timeout') || message.includes('exceeded')) {
    return new TimeoutError(message, 30000, context);
  }

  // Element errors
  if (message.includes('Element is not visible')) {
    return new ElementNotVisibleError(context?.selector || 'unknown', context);
  }
  
  if (message.includes('Element is not attached')) {
    return new ElementStaleError(context?.selector || 'unknown', context);
  }
  
  if (message.includes('strict mode violation')) {
    const count = message.match(/\d+/)?.[0] || 'multiple';
    return new MultipleElementsError(
      context?.selector || 'unknown',
      parseInt(count) || 2,
      context
    );
  }

  // Navigation errors
  if (message.includes('net::') || message.includes('NS_ERROR')) {
    return new NetworkError(message, context);
  }
  
  if (message.includes('SSL') || message.includes('certificate')) {
    return new SSLError(context?.url || 'unknown', context);
  }

  // Browser errors
  if (message.includes('Browser') || message.includes('crashed')) {
    return new BrowserCrashError(message, context);
  }

  // Default to generic PlayCloneError
  return new PlayCloneError(message, 'UNKNOWN_ERROR', {
    ...context,
    retryable: isRetryableError(error),
    cause: error,
  });
}

/**
 * Create error with retry information
 */
export function createRetryableError(
  message: string,
  attempts: number,
  maxAttempts: number,
  context?: any
): PlayCloneError {
  return new PlayCloneError(
    `${message} (attempt ${attempts}/${maxAttempts})`,
    'RETRY_ERROR',
    {
      ...context,
      retryable: attempts < maxAttempts,
      details: { attempts, maxAttempts },
      suggestion: attempts < maxAttempts
        ? `Will retry (${maxAttempts - attempts} attempts remaining)`
        : 'Maximum retry attempts reached',
    }
  );
}