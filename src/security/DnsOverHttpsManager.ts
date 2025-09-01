/**
 * DNS-over-HTTPS (DoH) Manager for secure DNS resolution
 * Provides privacy and security by encrypting DNS queries
 */

import { Browser, BrowserContext } from 'playwright-core';
import https from 'https';
import dns from 'dns';
import { URL } from 'url';

export interface DoHProvider {
  name: string;
  url: string;
  ips: string[];
  format: 'json' | 'dns-message';
  headers?: Record<string, string>;
}

export interface DoHConfig {
  provider?: string;
  customProvider?: DoHProvider;
  fallbackToDNS?: boolean;
  timeout?: number;
  cache?: boolean;
  cacheMaxAge?: number;
  validateDNSSEC?: boolean;
}

export interface DNSResponse {
  answers: DNSAnswer[];
  status: number;
  truncated: boolean;
  recursionDesired: boolean;
  recursionAvailable: boolean;
  authenticatedData: boolean;
  checkingDisabled: boolean;
  question?: DNSQuestion[];
}

export interface DNSAnswer {
  name: string;
  type: number;
  ttl: number;
  data: string;
  class?: number;
}

export interface DNSQuestion {
  name: string;
  type: number;
}

/**
 * Manages DNS-over-HTTPS for secure DNS resolution
 */
export class DnsOverHttpsManager {
  private providers: Map<string, DoHProvider>;
  private currentProvider: DoHProvider;
  private cache: Map<string, { response: DNSResponse; expires: number }>;
  private config: DoHConfig;

  constructor(config: DoHConfig = {}) {
    this.config = {
      provider: 'cloudflare',
      fallbackToDNS: true,
      timeout: 5000,
      cache: true,
      cacheMaxAge: 300000, // 5 minutes
      validateDNSSEC: false,
      ...config
    };

    this.cache = new Map();
    this.providers = new Map();
    this.initializeProviders();
    
    // Set current provider
    if (config.customProvider) {
      this.currentProvider = config.customProvider;
      this.providers.set('custom', config.customProvider);
    } else {
      this.currentProvider = this.providers.get(this.config.provider!) || this.providers.get('cloudflare')!;
    }
  }

  /**
   * Initialize default DoH providers
   */
  private initializeProviders(): void {
    // Cloudflare DNS
    this.providers.set('cloudflare', {
      name: 'Cloudflare DNS',
      url: 'https://cloudflare-dns.com/dns-query',
      ips: ['1.1.1.1', '1.0.0.1', '2606:4700:4700::1111', '2606:4700:4700::1001'],
      format: 'json',
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    // Google Public DNS
    this.providers.set('google', {
      name: 'Google Public DNS',
      url: 'https://dns.google/resolve',
      ips: ['8.8.8.8', '8.8.4.4', '2001:4860:4860::8888', '2001:4860:4860::8844'],
      format: 'json',
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    // Quad9
    this.providers.set('quad9', {
      name: 'Quad9',
      url: 'https://dns.quad9.net/dns-query',
      ips: ['9.9.9.9', '149.112.112.112', '2620:fe::fe', '2620:fe::9'],
      format: 'json',
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    // NextDNS
    this.providers.set('nextdns', {
      name: 'NextDNS',
      url: 'https://dns.nextdns.io',
      ips: ['45.90.28.0', '45.90.30.0'],
      format: 'json',
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    // AdGuard DNS
    this.providers.set('adguard', {
      name: 'AdGuard DNS',
      url: 'https://dns.adguard.com/dns-query',
      ips: ['94.140.14.14', '94.140.15.15'],
      format: 'json',
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    // OpenDNS
    this.providers.set('opendns', {
      name: 'OpenDNS',
      url: 'https://doh.opendns.com/dns-query',
      ips: ['208.67.222.222', '208.67.220.220'],
      format: 'json',
      headers: {
        'Accept': 'application/dns-json'
      }
    });
  }

  /**
   * Switch to a different DoH provider
   */
  public switchProvider(providerName: string): void {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Unknown DoH provider: ${providerName}`);
    }
    this.currentProvider = provider;
    this.clearCache(); // Clear cache when switching providers
  }

  /**
   * Get list of available providers
   */
  public getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get current provider info
   */
  public getCurrentProvider(): DoHProvider {
    return this.currentProvider;
  }

  /**
   * Resolve a hostname using DoH
   */
  public async resolve(hostname: string, type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' = 'A'): Promise<string[]> {
    // Check cache first
    if (this.config.cache) {
      const cached = this.getFromCache(`${hostname}:${type}`);
      if (cached) {
        return this.extractAddresses(cached, type);
      }
    }

    try {
      // Perform DoH query
      const response = await this.queryDoH(hostname, type);
      
      // Cache the response
      if (this.config.cache && response) {
        this.addToCache(`${hostname}:${type}`, response);
      }

      return this.extractAddresses(response, type);
    } catch (error) {
      // Fallback to regular DNS if configured
      if (this.config.fallbackToDNS) {
        return this.fallbackToRegularDNS(hostname, type);
      }
      throw error;
    }
  }

  /**
   * Perform DoH query
   */
  private async queryDoH(hostname: string, type: string): Promise<DNSResponse> {
    const typeMap: Record<string, number> = {
      'A': 1,
      'AAAA': 28,
      'CNAME': 5,
      'MX': 15,
      'TXT': 16
    };

    const queryType = typeMap[type] || 1;
    const url = new URL(this.currentProvider.url);
    
    // Add query parameters for JSON format
    if (this.currentProvider.format === 'json') {
      url.searchParams.set('name', hostname);
      url.searchParams.set('type', queryType.toString());
      
      if (this.config.validateDNSSEC) {
        url.searchParams.set('do', 'true');
      }
    }

    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        headers: this.currentProvider.headers || {},
        timeout: this.config.timeout
      };

      const req = https.request(url.toString(), options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (this.currentProvider.format === 'json') {
              const response = JSON.parse(data);
              resolve(this.normalizeResponse(response));
            } else {
              // Handle DNS message format if needed
              reject(new Error('DNS message format not yet implemented'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse DoH response: ${error}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('DoH query timeout'));
      });

      req.end();
    });
  }

  /**
   * Normalize response from different providers
   */
  private normalizeResponse(response: any): DNSResponse {
    // Handle different response formats from various providers
    const normalized: DNSResponse = {
      status: response.Status || response.status || 0,
      truncated: response.TC || response.truncated || false,
      recursionDesired: response.RD !== undefined ? response.RD : true,
      recursionAvailable: response.RA !== undefined ? response.RA : true,
      authenticatedData: response.AD || response.authenticatedData || false,
      checkingDisabled: response.CD || response.checkingDisabled || false,
      answers: [],
      question: []
    };

    // Normalize answers
    if (response.Answer || response.answers) {
      const answers = response.Answer || response.answers;
      normalized.answers = answers.map((answer: any) => ({
        name: answer.name,
        type: answer.type,
        ttl: answer.TTL || answer.ttl,
        data: answer.data || answer.value || answer.address,
        class: answer.class
      }));
    }

    // Normalize questions
    if (response.Question || response.questions) {
      const questions = response.Question || response.questions;
      normalized.question = questions.map((q: any) => ({
        name: q.name,
        type: q.type
      }));
    }

    return normalized;
  }

  /**
   * Extract addresses from DNS response
   */
  private extractAddresses(response: DNSResponse, type: string): string[] {
    const addresses: string[] = [];
    const typeMap: Record<string, number> = {
      'A': 1,
      'AAAA': 28,
      'CNAME': 5,
      'MX': 15,
      'TXT': 16
    };

    const targetType = typeMap[type];
    
    for (const answer of response.answers) {
      if (answer.type === targetType) {
        addresses.push(answer.data);
      }
    }

    return addresses;
  }

  /**
   * Fallback to regular DNS resolution
   */
  private async fallbackToRegularDNS(hostname: string, type: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const resolveMethod = type === 'AAAA' ? dns.resolve6 :
                           type === 'CNAME' ? dns.resolveCname :
                           type === 'MX' ? dns.resolveMx :
                           type === 'TXT' ? dns.resolveTxt :
                           dns.resolve4;

      resolveMethod(hostname, (err, addresses) => {
        if (err) {
          reject(err);
        } else {
          // Handle different response types
          if (type === 'MX') {
            resolve((addresses as any[]).map(mx => `${mx.priority} ${mx.exchange}`));
          } else if (type === 'TXT') {
            resolve((addresses as string[][]).flat());
          } else {
            resolve(addresses as string[]);
          }
        }
      });
    });
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): DNSResponse | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.response;
    }
    // Remove expired entry
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Add to cache
   */
  private addToCache(key: string, response: DNSResponse): void {
    const ttl = Math.min(
      ...response.answers.map(a => a.ttl * 1000),
      this.config.cacheMaxAge!
    );
    
    this.cache.set(key, {
      response,
      expires: Date.now() + ttl
    });
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Apply DoH configuration to browser context
   */
  public async applyToBrowser(browser: Browser | BrowserContext): Promise<void> {
    // Get the context (either from browser or use directly)
    const context = 'newContext' in browser ? 
      await browser.newContext() : 
      browser as BrowserContext;

    // Route all DNS-like requests through our DoH resolver
    await context.route('**/*', async (route, request) => {
      const url = request.url();
      
      // Check if this is a request that needs DNS resolution
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        // Skip if it's already an IP address
        if (this.isIPAddress(hostname)) {
          return route.continue();
        }

        // Resolve the hostname using DoH
        const addresses = await this.resolve(hostname, 'A');
        if (addresses.length > 0) {
          // Update the URL with resolved IP
          urlObj.hostname = addresses[0];
          
          // Continue with modified request
          return route.continue({
            url: urlObj.toString(),
            headers: {
              ...request.headers(),
              'Host': hostname // Preserve original hostname in Host header
            }
          });
        }
      } catch (error) {
        // If resolution fails, continue with original request
        console.warn(`DoH resolution failed for ${url}:`, error);
      }

      return route.continue();
    });
  }

  /**
   * Check if a string is an IP address
   */
  private isIPAddress(str: string): boolean {
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    
    return ipv4Pattern.test(str) || ipv6Pattern.test(str);
  }

  /**
   * Get statistics about DNS resolution
   */
  public getStats(): {
    provider: string;
    cacheSize: number;
    cacheHitRate: number;
    totalQueries: number;
    failedQueries: number;
  } {
    // This would need to track statistics in a real implementation
    return {
      provider: this.currentProvider.name,
      cacheSize: this.cache.size,
      cacheHitRate: 0, // Would need to track this
      totalQueries: 0, // Would need to track this
      failedQueries: 0 // Would need to track this
    };
  }

  /**
   * Test DoH connectivity
   */
  public async testConnectivity(): Promise<boolean> {
    try {
      const addresses = await this.resolve('example.com', 'A');
      return addresses.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Configure browser to use secure DNS
   */
  public static getBrowserArgs(provider: string = 'cloudflare'): string[] {
    const providerUrls: Record<string, string> = {
      'cloudflare': 'https://cloudflare-dns.com/dns-query',
      'google': 'https://dns.google/dns-query',
      'quad9': 'https://dns.quad9.net/dns-query',
      'nextdns': 'https://dns.nextdns.io/dns-query',
      'adguard': 'https://dns.adguard.com/dns-query'
    };

    const url = providerUrls[provider] || providerUrls['cloudflare'];

    return [
      '--enable-features=DnsOverHttps',
      `--dns-over-https-server=${url}`,
      '--dns-over-https-templates',
      '--force-dns-over-https'
    ];
  }
}