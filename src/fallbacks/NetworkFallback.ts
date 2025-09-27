/**
 * NetworkFallback - Handles network-related failures with intelligent fallbacks
 * 
 * Provides resilience for:
 * - DNS resolution failures
 * - Proxy connection issues
 * - SSL/TLS errors
 * - Connection timeouts
 * - Rate limiting
 */

import * as dns from 'dns';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { Logger } from '../utils/Logger';

interface NetworkConfig {
  timeout?: number;
  retries?: number;
  proxy?: {
    host: string;
    port: number;
    auth?: { username: string; password: string };
  };
  dnsServers?: string[];
  fallbackDNS?: boolean;
}

interface DNSCache {
  [hostname: string]: {
    addresses: string[];
    timestamp: number;
    ttl: number;
  };
}

export class NetworkFallback {
  private readonly logger = new Logger('NetworkFallback');
  private dnsCache: DNSCache = {};
  private readonly cacheTTL = 300000; // 5 minutes
  private failedHosts: Map<string, number> = new Map();
  private readonly failureThreshold = 3;
  private readonly failureCooldown = 60000; // 1 minute

  constructor(private config: NetworkConfig = {}) {
    this.initializeDNS();
  }

  private initializeDNS(): void {
    if (this.config.dnsServers && this.config.dnsServers.length > 0) {
      dns.setServers(this.config.dnsServers);
    }
  }

  /**
   * Resolve hostname with fallback strategies
   */
  async resolveHostname(hostname: string): Promise<string[]> {
    // Check cache first
    const cached = this.getCachedDNS(hostname);
    if (cached) {
      return cached;
    }

    // Check if host is in failure state
    if (this.isHostFailed(hostname)) {
      throw new Error(`Host ${hostname} is temporarily blocked due to repeated failures`);
    }

    const strategies = [
      () => this.systemDNSResolve(hostname),
      () => this.dnsOverHTTPS(hostname, 'cloudflare'),
      () => this.dnsOverHTTPS(hostname, 'google'),
      () => this.dnsOverHTTPS(hostname, 'quad9'),
      () => this.fallbackToIP(hostname)
    ];

    let lastError: Error | null = null;
    
    for (const strategy of strategies) {
      try {
        const addresses = await strategy();
        if (addresses && addresses.length > 0) {
          this.cacheDNS(hostname, addresses);
          this.clearHostFailure(hostname);
          return addresses;
        }
      } catch (error) {
        lastError = error as Error;
        this.logger.debug(`DNS strategy failed: ${lastError.message}`);
      }
    }

    this.markHostFailed(hostname);
    throw lastError || new Error(`Failed to resolve ${hostname}`);
  }

  /**
   * System DNS resolution
   */
  private async systemDNSResolve(hostname: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      dns.resolve4(hostname, (err, addresses) => {
        if (err) {
          // Try IPv6
          dns.resolve6(hostname, (err6, addresses6) => {
            if (err6) {
              reject(err);
            } else {
              resolve(addresses6);
            }
          });
        } else {
          resolve(addresses);
        }
      });
    });
  }

  /**
   * DNS over HTTPS resolution
   */
  private async dnsOverHTTPS(hostname: string, provider: 'cloudflare' | 'google' | 'quad9'): Promise<string[]> {
    const providers = {
      cloudflare: 'https://cloudflare-dns.com/dns-query',
      google: 'https://dns.google/resolve',
      quad9: 'https://dns.quad9.net/dns-query'
    };

    const url = new URL(providers[provider]);
    url.searchParams.set('name', hostname);
    url.searchParams.set('type', 'A');

    return new Promise((resolve, reject) => {
      const request = https.get(url.toString(), {
        headers: { 'Accept': 'application/dns-json' },
        timeout: this.config.timeout || 5000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.Answer) {
              const addresses = response.Answer
                .filter((a: any) => a.type === 1 || a.type === 28)
                .map((a: any) => a.data);
              resolve(addresses);
            } else {
              reject(new Error('No DNS answers received'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('DNS over HTTPS timeout'));
      });
    });
  }

  /**
   * Fallback to direct IP if hostname is already an IP
   */
  private async fallbackToIP(hostname: string): Promise<string[]> {
    // Check if hostname is already an IP address
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([\da-f]{1,4}:){7}[\da-f]{1,4}$/i;
    
    if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
      return [hostname];
    }
    
    throw new Error('Not an IP address');
  }

  /**
   * Make HTTP request with fallback strategies
   */
  async makeRequest(url: string, options: any = {}): Promise<any> {
    const parsedUrl = new URL(url);
    const isHTTPS = parsedUrl.protocol === 'https:';
    
    // Resolve hostname first
    let addresses: string[];
    try {
      addresses = await this.resolveHostname(parsedUrl.hostname);
    } catch (error) {
      this.logger.error(`Failed to resolve ${parsedUrl.hostname}: ${error}`);
      throw error;
    }

    // Try each resolved address
    for (const address of addresses) {
      try {
        const result = await this.attemptRequest(address, parsedUrl, options, isHTTPS);
        return result;
      } catch (error) {
        this.logger.debug(`Request to ${address} failed: ${error}`);
      }
    }

    throw new Error(`All request attempts failed for ${url}`);
  }

  /**
   * Attempt single request
   */
  private async attemptRequest(
    address: string, 
    url: URL, 
    options: any, 
    isHTTPS: boolean
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        ...options,
        hostname: address,
        port: url.port || (isHTTPS ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          ...options.headers,
          'Host': url.hostname // Important for virtual hosts
        },
        timeout: this.config.timeout || 10000
      };

      // Handle proxy if configured
      if (this.config.proxy) {
        requestOptions.hostname = this.config.proxy.host;
        requestOptions.port = this.config.proxy.port;
        requestOptions.path = url.toString();
        
        if (this.config.proxy.auth) {
          const auth = Buffer.from(
            `${this.config.proxy.auth.username}:${this.config.proxy.auth.password}`
          ).toString('base64');
          requestOptions.headers['Proxy-Authorization'] = `Basic ${auth}`;
        }
      }

      const protocol = isHTTPS ? https : http;
      const request = protocol.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ 
          statusCode: res.statusCode, 
          headers: res.headers, 
          body: data 
        }));
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });

      request.end();
    });
  }

  /**
   * Handle SSL/TLS errors with fallback
   */
  async handleSSLError(url: string, error: Error): Promise<any> {
    this.logger.warn(`SSL error for ${url}: ${error.message}`);
    
    // Try with relaxed SSL settings (for testing only!)
    const parsedUrl = new URL(url);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: 'GET',
        rejectUnauthorized: false, // Ignore SSL errors (UNSAFE!)
        timeout: this.config.timeout || 10000
      };

      const request = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ 
          statusCode: res.statusCode, 
          headers: res.headers, 
          body: data,
          sslWarning: true 
        }));
      });

      request.on('error', reject);
      request.end();
    });
  }

  /**
   * Handle rate limiting with exponential backoff
   */
  async handleRateLimit(
    fn: () => Promise<any>, 
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error
        if (error.statusCode === 429 || error.message.includes('rate limit')) {
          const delay = Math.pow(2, i) * 1000; // Exponential backoff
          this.logger.info(`Rate limited. Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Cache DNS result
   */
  private cacheDNS(hostname: string, addresses: string[]): void {
    this.dnsCache[hostname] = {
      addresses,
      timestamp: Date.now(),
      ttl: this.cacheTTL
    };
  }

  /**
   * Get cached DNS result
   */
  private getCachedDNS(hostname: string): string[] | null {
    const cached = this.dnsCache[hostname];
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.addresses;
    }
    return null;
  }

  /**
   * Mark host as failed
   */
  private markHostFailed(hostname: string): void {
    const failures = (this.failedHosts.get(hostname) || 0) + 1;
    this.failedHosts.set(hostname, failures);
  }

  /**
   * Check if host is in failure state
   */
  private isHostFailed(hostname: string): boolean {
    const failures = this.failedHosts.get(hostname) || 0;
    return failures >= this.failureThreshold;
  }

  /**
   * Clear host failure state
   */
  private clearHostFailure(hostname: string): void {
    this.failedHosts.delete(hostname);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.dnsCache = {};
    this.failedHosts.clear();
  }

  /**
   * Get network diagnostics
   */
  getDiagnostics(): any {
    return {
      dnsCache: Object.keys(this.dnsCache).length,
      failedHosts: Array.from(this.failedHosts.entries()),
      config: this.config
    };
  }
}