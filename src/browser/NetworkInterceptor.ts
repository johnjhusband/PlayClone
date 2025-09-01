/**
 * NetworkInterceptor - Handles network request interception and modification
 */

import { Page, Route, Request, Response } from 'playwright';

/**
 * Network request matcher
 */
export interface RequestMatcher {
  url?: string | RegExp;
  method?: string;
  resourceType?: string;
  headers?: Record<string, string>;
}

/**
 * Request modification options
 */
export interface RequestModification {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  postData?: string | Buffer;
}

/**
 * Response modification options
 */
export interface ResponseModification {
  status?: number;
  headers?: Record<string, string>;
  body?: string | Buffer;
  contentType?: string;
}

/**
 * Intercepted request details
 */
export interface InterceptedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  resourceType: string;
  timestamp: number;
  isNavigationRequest: boolean;
}

/**
 * Intercepted response details
 */
export interface InterceptedResponse {
  id: string;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: Buffer;
  timestamp: number;
  duration: number;
}

/**
 * Network throttling profile
 */
export interface ThrottlingProfile {
  name: string;
  downloadSpeed: number; // bytes per second
  uploadSpeed: number; // bytes per second
  latency: number; // milliseconds
}

/**
 * Predefined throttling profiles
 */
export const THROTTLING_PROFILES: Record<string, ThrottlingProfile> = {
  'Fast 3G': {
    name: 'Fast 3G',
    downloadSpeed: 1.6 * 1024 * 1024 / 8, // 1.6 Mbps
    uploadSpeed: 750 * 1024 / 8, // 750 Kbps
    latency: 562
  },
  'Slow 3G': {
    name: 'Slow 3G',
    downloadSpeed: 780 * 1024 / 8, // 780 Kbps
    uploadSpeed: 330 * 1024 / 8, // 330 Kbps
    latency: 1500
  },
  'Offline': {
    name: 'Offline',
    downloadSpeed: 0,
    uploadSpeed: 0,
    latency: 0
  },
  'Fast 4G': {
    name: 'Fast 4G',
    downloadSpeed: 12 * 1024 * 1024 / 8, // 12 Mbps
    uploadSpeed: 3 * 1024 * 1024 / 8, // 3 Mbps
    latency: 70
  },
  'Regular 4G': {
    name: 'Regular 4G',
    downloadSpeed: 4 * 1024 * 1024 / 8, // 4 Mbps
    uploadSpeed: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
    latency: 175
  },
  'DSL': {
    name: 'DSL',
    downloadSpeed: 2 * 1024 * 1024 / 8, // 2 Mbps
    uploadSpeed: 384 * 1024 / 8, // 384 Kbps
    latency: 50
  },
  'WiFi': {
    name: 'WiFi',
    downloadSpeed: 30 * 1024 * 1024 / 8, // 30 Mbps
    uploadSpeed: 15 * 1024 * 1024 / 8, // 15 Mbps
    latency: 10
  }
};

/**
 * Request handler callback
 */
export type RequestHandler = (request: InterceptedRequest, route: Route) => Promise<void> | void;

/**
 * Response handler callback
 */
export type ResponseHandler = (response: InterceptedResponse) => Promise<void> | void;

/**
 * Manages network request interception and modification
 */
export class NetworkInterceptor {
  private page: Page | null = null;
  private interceptedRequests: Map<string, InterceptedRequest> = new Map();
  private interceptedResponses: Map<string, InterceptedResponse> = new Map();
  private requestHandlers: Map<string, RequestHandler> = new Map();
  private responseHandlers: Map<string, ResponseHandler> = new Map();
  private blockedUrls: Set<string | RegExp> = new Set();
  private mockedResponses: Map<string | RegExp, ResponseModification> = new Map();
  private requestIdCounter = 0;
  private isIntercepting = false;

  /**
   * Attach interceptor to a page
   */
  async attach(page: Page): Promise<void> {
    this.page = page;
    
    // Set up request interception
    await page.route('**/*', async (route, request) => {
      await this.handleRequest(route, request);
    });

    // Set up response listener
    page.on('response', async (response) => {
      await this.handleResponse(response);
    });

    this.isIntercepting = true;
  }

  /**
   * Detach interceptor from the page
   */
  async detach(): Promise<void> {
    if (this.page) {
      await this.page.unroute('**/*');
      this.page = null;
    }
    this.isIntercepting = false;
    this.clear();
  }

  /**
   * Handle intercepted request
   */
  private async handleRequest(route: Route, request: Request): Promise<void> {
    const requestId = `req_${++this.requestIdCounter}`;
    
    // Create intercepted request object
    const interceptedRequest: InterceptedRequest = {
      id: requestId,
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData() || undefined,
      resourceType: request.resourceType(),
      timestamp: Date.now(),
      isNavigationRequest: request.isNavigationRequest()
    };

    this.interceptedRequests.set(requestId, interceptedRequest);

    // Check if URL is blocked
    const isBlocked = this.isUrlBlocked(interceptedRequest.url);
    if (isBlocked) {
      await route.abort();
      return;
    }

    // Check for mocked response
    const mockedResponse = this.getMockedResponse(interceptedRequest.url);
    if (mockedResponse) {
      await route.fulfill(mockedResponse);
      return;
    }

    // Execute custom request handlers
    let handled = false;
    for (const handler of this.requestHandlers.values()) {
      await handler(interceptedRequest, route);
      // Check if route was handled by checking if we can still continue
      // In Playwright, once a route is handled, calling continue/fulfill/abort again will throw
      try {
        // Try a no-op to see if route is still available
        handled = true;
        break;
      } catch {
        // Route already handled
      }
    }

    // If no handler modified the request, continue normally
    if (!handled) {
      try {
        await route.continue();
      } catch {
        // Route was already handled
      }
    }
  }

  /**
   * Handle intercepted response
   */
  private async handleResponse(response: Response): Promise<void> {
    const request = response.request();
    const requestId = this.findRequestId(request.url());
    
    if (requestId) {
      const startTime = this.interceptedRequests.get(requestId)?.timestamp || Date.now();
      
      const interceptedResponse: InterceptedResponse = {
        id: `res_${requestId}`,
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };

      // Try to get response body (may fail for some responses)
      try {
        interceptedResponse.body = await response.body();
      } catch {
        // Ignore body fetch errors
      }

      this.interceptedResponses.set(interceptedResponse.id, interceptedResponse);

      // Execute custom response handlers
      for (const handler of this.responseHandlers.values()) {
        await handler(interceptedResponse);
      }
    }
  }

  /**
   * Block requests to specific URLs
   */
  blockUrl(pattern: string | RegExp): void {
    this.blockedUrls.add(pattern);
  }

  /**
   * Unblock a URL pattern
   */
  unblockUrl(pattern: string | RegExp): void {
    this.blockedUrls.delete(pattern);
  }

  /**
   * Clear all blocked URLs
   */
  clearBlockedUrls(): void {
    this.blockedUrls.clear();
  }

  /**
   * Check if a URL is blocked
   */
  private isUrlBlocked(url: string): boolean {
    for (const pattern of this.blockedUrls) {
      if (typeof pattern === 'string') {
        if (url.includes(pattern)) return true;
      } else {
        if (pattern.test(url)) return true;
      }
    }
    return false;
  }

  /**
   * Mock response for a URL pattern
   */
  mockResponse(pattern: string | RegExp, response: ResponseModification): void {
    this.mockedResponses.set(pattern, response);
  }

  /**
   * Remove a mocked response
   */
  removeMockResponse(pattern: string | RegExp): void {
    this.mockedResponses.delete(pattern);
  }

  /**
   * Clear all mocked responses
   */
  clearMockResponses(): void {
    this.mockedResponses.clear();
  }

  /**
   * Get mocked response for a URL
   */
  private getMockedResponse(url: string): ResponseModification | null {
    for (const [pattern, response] of this.mockedResponses) {
      if (typeof pattern === 'string') {
        if (url.includes(pattern)) return response;
      } else {
        if (pattern.test(url)) return response;
      }
    }
    return null;
  }

  /**
   * Add a request handler
   */
  addRequestHandler(id: string, handler: RequestHandler): void {
    this.requestHandlers.set(id, handler);
  }

  /**
   * Remove a request handler
   */
  removeRequestHandler(id: string): void {
    this.requestHandlers.delete(id);
  }

  /**
   * Add a response handler
   */
  addResponseHandler(id: string, handler: ResponseHandler): void {
    this.responseHandlers.set(id, handler);
  }

  /**
   * Remove a response handler
   */
  removeResponseHandler(id: string): void {
    this.responseHandlers.delete(id);
  }

  /**
   * Modify request headers
   */
  async modifyRequestHeaders(pattern: string | RegExp, headers: Record<string, string>): Promise<void> {
    this.addRequestHandler(`headers_${Date.now()}`, async (interceptedReq, route) => {
      const matches = typeof pattern === 'string' 
        ? interceptedReq.url.includes(pattern)
        : pattern.test(interceptedReq.url);
      
      if (matches) {
        await route.continue({
          headers: {
            ...interceptedReq.headers,
            ...headers
          }
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Apply network throttling
   */
  async applyThrottling(profile: string | ThrottlingProfile): Promise<void> {
    if (!this.page) {
      throw new Error('No page attached');
    }

    const throttleProfile = typeof profile === 'string' 
      ? THROTTLING_PROFILES[profile]
      : profile;

    if (!throttleProfile) {
      throw new Error(`Throttling profile "${profile}" not found`);
    }

    // Playwright doesn't have built-in throttling, but we can simulate it
    // by delaying requests and responses
    const latency = throttleProfile.latency;
    
    this.addRequestHandler('throttle_request', async (_request, route) => {
      if (latency > 0) {
        await new Promise(resolve => setTimeout(resolve, latency));
      }
      await route.continue();
    });
  }

  /**
   * Remove network throttling
   */
  removeThrottling(): void {
    this.removeRequestHandler('throttle_request');
  }

  /**
   * Get all intercepted requests
   */
  getRequests(): InterceptedRequest[] {
    return Array.from(this.interceptedRequests.values());
  }

  /**
   * Get all intercepted responses
   */
  getResponses(): InterceptedResponse[] {
    return Array.from(this.interceptedResponses.values());
  }

  /**
   * Get requests matching a pattern
   */
  getRequestsByPattern(pattern: string | RegExp): InterceptedRequest[] {
    return this.getRequests().filter(req => {
      if (typeof pattern === 'string') {
        return req.url.includes(pattern);
      }
      return pattern.test(req.url);
    });
  }

  /**
   * Get responses matching a pattern
   */
  getResponsesByPattern(pattern: string | RegExp): InterceptedResponse[] {
    return this.getResponses().filter(res => {
      if (typeof pattern === 'string') {
        return res.url.includes(pattern);
      }
      return pattern.test(res.url);
    });
  }

  /**
   * Find request ID by URL
   */
  private findRequestId(url: string): string | null {
    for (const [id, request] of this.interceptedRequests) {
      if (request.url === url) {
        return id;
      }
    }
    return null;
  }

  /**
   * Clear all intercepted data
   */
  clear(): void {
    this.interceptedRequests.clear();
    this.interceptedResponses.clear();
  }

  /**
   * Get network statistics
   */
  getStatistics(): {
    totalRequests: number;
    totalResponses: number;
    blockedRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    totalBytesReceived: number;
  } {
    const requests = this.getRequests();
    const responses = this.getResponses();
    
    const failedRequests = responses.filter(r => r.status >= 400).length;
    const responseTimes = responses.map(r => r.duration);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    
    const totalBytesReceived = responses.reduce((total, res) => {
      return total + (res.body?.length || 0);
    }, 0);

    return {
      totalRequests: requests.length,
      totalResponses: responses.length,
      blockedRequests: 0, // Would need to track this separately
      failedRequests,
      averageResponseTime,
      totalBytesReceived
    };
  }

  /**
   * Export captured traffic as HAR (HTTP Archive)
   */
  exportHAR(): any {
    const entries = this.getRequests().map(request => {
      const response = this.getResponses().find(r => r.url === request.url);
      
      return {
        startedDateTime: new Date(request.timestamp).toISOString(),
        time: response ? response.duration : 0,
        request: {
          method: request.method,
          url: request.url,
          headers: Object.entries(request.headers).map(([name, value]) => ({ name, value })),
          postData: request.postData ? { text: request.postData } : undefined
        },
        response: response ? {
          status: response.status,
          statusText: response.statusText,
          headers: Object.entries(response.headers).map(([name, value]) => ({ name, value })),
          content: {
            size: response.body?.length || 0,
            mimeType: response.headers['content-type'] || 'application/octet-stream'
          }
        } : undefined
      };
    });

    return {
      log: {
        version: '1.2',
        creator: {
          name: 'PlayClone NetworkInterceptor',
          version: '1.1.0'
        },
        entries
      }
    };
  }

  /**
   * Check if interception is active
   */
  isActive(): boolean {
    return this.isIntercepting;
  }
}