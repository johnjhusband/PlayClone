/**
 * CookieManager - Handles browser cookie operations for PlayClone
 */

import { BrowserContext } from 'playwright-core';
import { Cookie, CookieResult } from '../types';

/**
 * Manages browser cookies with AI-optimized responses
 */
export class CookieManager {
  /**
   * Get all cookies from the current page or filtered by domain/name
   */
  async getCookies(
    context: BrowserContext,
    options?: { 
      domain?: string; 
      name?: string; 
      url?: string;
    }
  ): Promise<CookieResult> {
    try {
      let cookies = await context.cookies();
      
      // Filter by URL if provided
      if (options?.url) {
        cookies = await context.cookies(options.url);
      }
      
      // Additional filtering by domain
      if (options?.domain) {
        cookies = cookies.filter(c => 
          c.domain === options.domain || 
          c.domain === `.${options.domain}` ||
          (c.domain?.endsWith(`.${options.domain}`) ?? false)
        );
      }
      
      // Filter by name
      if (options?.name) {
        cookies = cookies.filter(c => c.name === options.name);
      }
      
      // Convert to our Cookie format
      const formattedCookies: Cookie[] = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        ...('size' in c && c.size !== undefined && { size: c.size as number }),
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite as 'Strict' | 'Lax' | 'None'
      }));
      
      return {
        success: true,
        action: 'getCookies' as const,
        cookies: formattedCookies,
        count: formattedCookies.length,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        action: 'getCookies' as const,
        error: error instanceof Error ? error.message : 'Failed to get cookies',
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Set a cookie
   */
  async setCookie(
    context: BrowserContext,
    cookie: Cookie
  ): Promise<CookieResult> {
    try {
      // Validate required fields
      if (!cookie.name || !cookie.value) {
        throw new Error('Cookie name and value are required');
      }
      
      // Build the cookie object for Playwright
      // Playwright needs either url or (domain + path)
      let cookieUrl = cookie.url;
      
      if (!cookieUrl && cookie.domain) {
        // Construct URL from domain
        const cleanDomain = cookie.domain.startsWith('.') ? 
          cookie.domain.substring(1) : cookie.domain;
        cookieUrl = `https://${cleanDomain}`;
      } else if (!cookieUrl && !cookie.domain) {
        // Get from current page
        const pages = context.pages();
        if (pages.length > 0) {
          const currentUrl = pages[0].url();
          if (currentUrl && currentUrl !== 'about:blank') {
            cookieUrl = currentUrl;
          }
        }
      }
      
      // Prepare cookie for Playwright
      const cookieToSet: any = {
        name: cookie.name,
        value: cookie.value
      };
      
      // Playwright requires either url alone OR (domain + path)
      if (cookieUrl) {
        cookieToSet.url = cookieUrl;
        // When using URL, don't add path separately
      } else if (cookie.domain) {
        // If using domain, we must also have path
        cookieToSet.domain = cookie.domain;
        cookieToSet.path = cookie.path || '/';
      }
      if (cookie.expires) cookieToSet.expires = cookie.expires;
      if (cookie.httpOnly !== undefined) cookieToSet.httpOnly = cookie.httpOnly;
      if (cookie.secure !== undefined) cookieToSet.secure = cookie.secure;
      if (cookie.sameSite) cookieToSet.sameSite = cookie.sameSite;
      
      await context.addCookies([cookieToSet]);
      
      return {
        success: true,
        action: 'setCookie' as const,
        cookie: cookie,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        action: 'setCookie' as const,
        error: error instanceof Error ? error.message : 'Failed to set cookie',
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Set multiple cookies at once
   */
  async setCookies(
    context: BrowserContext,
    cookies: Cookie[]
  ): Promise<CookieResult> {
    try {
      // Get current page URL if needed
      let defaultUrl: string | undefined;
      const pages = context.pages();
      if (pages.length > 0) {
        const currentUrl = pages[0].url();
        if (currentUrl && currentUrl !== 'about:blank') {
          defaultUrl = currentUrl;
        }
      }
      
      const cookiesToSet = cookies.map(cookie => {
        let cookieUrl = cookie.url;
        
        if (!cookieUrl && cookie.domain) {
          // Construct URL from domain
          const cleanDomain = cookie.domain.startsWith('.') ? 
            cookie.domain.substring(1) : cookie.domain;
          cookieUrl = `https://${cleanDomain}`;
        } else if (!cookieUrl && !cookie.domain) {
          // Use default from current page
          cookieUrl = defaultUrl;
        }
        
        const cookieToSet: any = {
          name: cookie.name,
          value: cookie.value
        };
        
        // Playwright requires either url alone OR (domain + path)
        if (cookieUrl) {
          cookieToSet.url = cookieUrl;
          // When using URL, don't add path separately
        } else if (cookie.domain) {
          // If using domain, we must also have path
          cookieToSet.domain = cookie.domain;
          cookieToSet.path = cookie.path || '/';
        }
        if (cookie.expires) cookieToSet.expires = cookie.expires;
        if (cookie.httpOnly !== undefined) cookieToSet.httpOnly = cookie.httpOnly;
        if (cookie.secure !== undefined) cookieToSet.secure = cookie.secure;
        if (cookie.sameSite) cookieToSet.sameSite = cookie.sameSite;
        
        return cookieToSet;
      });
      
      await context.addCookies(cookiesToSet);
      
      return {
        success: true,
        action: 'setCookie' as const,
        count: cookies.length,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        action: 'setCookie' as const,
        error: error instanceof Error ? error.message : 'Failed to set cookies',
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Delete a specific cookie
   */
  async deleteCookie(
    context: BrowserContext,
    name: string,
    options?: { domain?: string; path?: string }
  ): Promise<CookieResult> {
    try {
      // Get all cookies
      const cookies = await context.cookies();
      
      // Filter out the cookie to delete
      const filteredCookies = cookies.filter(c => {
        if (c.name !== name) return true;
        if (options?.domain && c.domain !== options.domain) return true;
        if (options?.path && c.path !== options.path) return true;
        return false;
      });
      
      // Clear all cookies and set the filtered ones back
      await context.clearCookies();
      if (filteredCookies.length > 0) {
        await context.addCookies(filteredCookies);
      }
      
      return {
        success: true,
        action: 'deleteCookie' as const,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        action: 'deleteCookie' as const,
        error: error instanceof Error ? error.message : 'Failed to delete cookie',
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Clear all cookies
   */
  async clearCookies(context: BrowserContext): Promise<CookieResult> {
    try {
      await context.clearCookies();
      
      return {
        success: true,
        action: 'clearCookies' as const,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        action: 'clearCookies' as const,
        error: error instanceof Error ? error.message : 'Failed to clear cookies',
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Get cookies as a string (for headers)
   */
  async getCookieString(
    context: BrowserContext,
    url: string
  ): Promise<string> {
    try {
      const cookies = await context.cookies(url);
      return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    } catch (error) {
      return '';
    }
  }
  
  /**
   * Parse cookie string into Cookie objects
   */
  parseCookieString(cookieString: string, domain?: string): Cookie[] {
    const cookies: Cookie[] = [];
    const pairs = cookieString.split(';').map(p => p.trim());
    
    for (const pair of pairs) {
      const [name, ...valueParts] = pair.split('=');
      if (name && valueParts.length > 0) {
        cookies.push({
          name: name.trim(),
          value: valueParts.join('=').trim(),
          ...(domain && { domain })
        });
      }
    }
    
    return cookies;
  }
  
  /**
   * Export cookies to JSON format
   */
  async exportCookies(context: BrowserContext): Promise<string> {
    try {
      const cookies = await context.cookies();
      return JSON.stringify(cookies, null, 2);
    } catch (error) {
      throw new Error(`Failed to export cookies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Import cookies from JSON format
   */
  async importCookies(
    context: BrowserContext,
    cookiesJson: string
  ): Promise<CookieResult> {
    try {
      const cookies = JSON.parse(cookiesJson);
      if (!Array.isArray(cookies)) {
        throw new Error('Invalid cookies format: expected an array');
      }
      
      await context.addCookies(cookies);
      
      return {
        success: true,
        action: 'setCookie' as const,
        count: cookies.length,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        action: 'setCookie' as const,
        error: error instanceof Error ? error.message : 'Failed to import cookies',
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Check if a specific cookie exists
   */
  async hasCookie(
    context: BrowserContext,
    name: string,
    options?: { domain?: string }
  ): Promise<boolean> {
    try {
      const result = await this.getCookies(context, { name, ...options });
      return result.success && (result.cookies?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }
  
  /**
   * Get cookie value by name
   */
  async getCookieValue(
    context: BrowserContext,
    name: string,
    options?: { domain?: string }
  ): Promise<string | null> {
    try {
      const result = await this.getCookies(context, { name, ...options });
      if (result.success && result.cookies && result.cookies.length > 0) {
        return result.cookies[0].value;
      }
      return null;
    } catch {
      return null;
    }
  }
}