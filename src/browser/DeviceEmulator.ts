/**
 * DeviceEmulator - Handles device emulation profiles for mobile, tablet, and desktop
 */

import { Page, BrowserContext } from 'playwright';

/**
 * Device viewport configuration
 */
export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  isLandscape?: boolean;
}

/**
 * Device emulation profile
 */
export interface DeviceProfile {
  name: string;
  viewport: ViewportConfig;
  userAgent: string;
  locale?: string;
  timezoneId?: string;
  geolocation?: { latitude: number; longitude: number };
  permissions?: string[];
  colorScheme?: 'light' | 'dark' | 'no-preference';
  reducedMotion?: 'reduce' | 'no-preference';
  forcedColors?: 'active' | 'none';
}

/**
 * Predefined device profiles
 */
export const DEVICE_PROFILES: Record<string, DeviceProfile> = {
  // Mobile Devices
  'iPhone 14 Pro': {
    name: 'iPhone 14 Pro',
    viewport: {
      width: 393,
      height: 852,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 14 Pro Max': {
    name: 'iPhone 14 Pro Max',
    viewport: {
      width: 430,
      height: 932,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 13': {
    name: 'iPhone 13',
    viewport: {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone SE': {
    name: 'iPhone SE',
    viewport: {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  'Samsung Galaxy S23': {
    name: 'Samsung Galaxy S23',
    viewport: {
      width: 360,
      height: 780,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  'Google Pixel 8': {
    name: 'Google Pixel 8',
    viewport: {
      width: 412,
      height: 915,
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  'Google Pixel 7 Pro': {
    name: 'Google Pixel 7 Pro',
    viewport: {
      width: 412,
      height: 892,
      deviceScaleFactor: 3.5,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },

  // Tablets
  'iPad Pro 12.9': {
    name: 'iPad Pro 12.9',
    viewport: {
      width: 1024,
      height: 1366,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  'iPad Pro 11': {
    name: 'iPad Pro 11',
    viewport: {
      width: 834,
      height: 1194,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  'iPad Air': {
    name: 'iPad Air',
    viewport: {
      width: 820,
      height: 1180,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  'iPad Mini': {
    name: 'iPad Mini',
    viewport: {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  'Samsung Galaxy Tab S9': {
    name: 'Samsung Galaxy Tab S9',
    viewport: {
      width: 753,
      height: 1205,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  'Surface Pro 9': {
    name: 'Surface Pro 9',
    viewport: {
      width: 912,
      height: 1368,
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: true,
      isLandscape: false
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
  },

  // Desktop Profiles
  'Desktop Chrome': {
    name: 'Desktop Chrome',
    viewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  'Desktop Firefox': {
    name: 'Desktop Firefox',
    viewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  },
  'Desktop Safari': {
    name: 'Desktop Safari',
    viewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false,
      isLandscape: true
    },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  },
  'Desktop Edge': {
    name: 'Desktop Edge',
    viewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
  },
  'MacBook Pro 16': {
    name: 'MacBook Pro 16',
    viewport: {
      width: 3456,
      height: 2234,
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false,
      isLandscape: true
    },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  'Desktop 4K': {
    name: 'Desktop 4K',
    viewport: {
      width: 3840,
      height: 2160,
      deviceScaleFactor: 1.5,
      isMobile: false,
      hasTouch: false,
      isLandscape: true
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  'Desktop HD': {
    name: 'Desktop HD',
    viewport: {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

/**
 * Device categories for easy filtering
 */
export const DEVICE_CATEGORIES = {
  mobile: [
    'iPhone 14 Pro',
    'iPhone 14 Pro Max',
    'iPhone 13',
    'iPhone SE',
    'Samsung Galaxy S23',
    'Google Pixel 8',
    'Google Pixel 7 Pro'
  ],
  tablet: [
    'iPad Pro 12.9',
    'iPad Pro 11',
    'iPad Air',
    'iPad Mini',
    'Samsung Galaxy Tab S9',
    'Surface Pro 9'
  ],
  desktop: [
    'Desktop Chrome',
    'Desktop Firefox',
    'Desktop Safari',
    'Desktop Edge',
    'MacBook Pro 16',
    'Desktop 4K',
    'Desktop HD'
  ]
};

/**
 * Manages device emulation for browser contexts and pages
 */
export class DeviceEmulator {
  private currentProfile: DeviceProfile | null = null;
  private customProfiles: Map<string, DeviceProfile> = new Map();

  /**
   * Get all available device profiles
   */
  getAvailableProfiles(): string[] {
    return [
      ...Object.keys(DEVICE_PROFILES),
      ...Array.from(this.customProfiles.keys())
    ];
  }

  /**
   * Get profiles by category
   */
  getProfilesByCategory(category: 'mobile' | 'tablet' | 'desktop'): string[] {
    return DEVICE_CATEGORIES[category] || [];
  }

  /**
   * Get a specific device profile
   */
  getProfile(name: string): DeviceProfile | null {
    return DEVICE_PROFILES[name] || this.customProfiles.get(name) || null;
  }

  /**
   * Add a custom device profile
   */
  addCustomProfile(profile: DeviceProfile): void {
    this.customProfiles.set(profile.name, profile);
  }

  /**
   * Remove a custom device profile
   */
  removeCustomProfile(name: string): boolean {
    return this.customProfiles.delete(name);
  }

  /**
   * Apply device emulation to a browser context
   */
  async applyToContext(context: BrowserContext, profileName: string): Promise<void> {
    const profile = this.getProfile(profileName);
    if (!profile) {
      throw new Error(`Device profile "${profileName}" not found`);
    }

    // Note: BrowserContext doesn't have direct viewport setting
    // Viewport is set when creating the context or on individual pages
    // We'll apply viewport to all existing pages in the context
    const pages = context.pages();
    for (const page of pages) {
      await page.setViewportSize({
        width: profile.viewport.width,
        height: profile.viewport.height
      });
    }

    // Apply geolocation if specified
    if (profile.geolocation) {
      await context.setGeolocation(profile.geolocation);
    }

    // Apply permissions if specified
    if (profile.permissions && profile.permissions.length > 0) {
      await context.grantPermissions(profile.permissions);
    }

    // Store current profile
    this.currentProfile = profile;
  }

  /**
   * Apply device emulation to a page
   */
  async applyToPage(page: Page, profileName: string): Promise<void> {
    const profile = this.getProfile(profileName);
    if (!profile) {
      throw new Error(`Device profile "${profileName}" not found`);
    }

    // Set viewport
    await page.setViewportSize({
      width: profile.viewport.width,
      height: profile.viewport.height
    });

    // Set user agent
    await page.setExtraHTTPHeaders({
      'User-Agent': profile.userAgent
    });

    // Store current profile
    this.currentProfile = profile;
  }

  /**
   * Create a custom profile from current page settings
   */
  async createProfileFromPage(page: Page, name: string): Promise<DeviceProfile> {
    const viewport = page.viewportSize();
    if (!viewport) {
      throw new Error('Page has no viewport size set');
    }

    const profile: DeviceProfile = {
      name,
      viewport: {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        isLandscape: viewport.width > viewport.height
      },
      userAgent: await page.evaluate(() => navigator.userAgent)
    };

    // Try to get additional info
    try {
      const deviceInfo = await page.evaluate(() => ({
        pixelRatio: window.devicePixelRatio,
        touchSupport: 'ontouchstart' in window,
        language: navigator.language,
        platform: navigator.platform
      }));

      profile.viewport.deviceScaleFactor = deviceInfo.pixelRatio;
      profile.viewport.hasTouch = deviceInfo.touchSupport;
      profile.locale = deviceInfo.language;
    } catch (error) {
      // Ignore errors getting additional info
    }

    this.addCustomProfile(profile);
    return profile;
  }

  /**
   * Get the current emulation profile
   */
  getCurrentProfile(): DeviceProfile | null {
    return this.currentProfile;
  }

  /**
   * Clear the current emulation profile
   */
  clearProfile(): void {
    this.currentProfile = null;
  }

  /**
   * Create a landscape version of a profile
   */
  createLandscapeProfile(profileName: string): DeviceProfile | null {
    const profile = this.getProfile(profileName);
    if (!profile) {
      return null;
    }

    const landscapeProfile: DeviceProfile = {
      ...profile,
      name: `${profile.name} (Landscape)`,
      viewport: {
        ...profile.viewport,
        width: profile.viewport.height,
        height: profile.viewport.width,
        isLandscape: true
      }
    };

    return landscapeProfile;
  }

  /**
   * Export all custom profiles
   */
  exportCustomProfiles(): DeviceProfile[] {
    return Array.from(this.customProfiles.values());
  }

  /**
   * Import custom profiles
   */
  importCustomProfiles(profiles: DeviceProfile[]): void {
    for (const profile of profiles) {
      this.addCustomProfile(profile);
    }
  }

  /**
   * Reset to default profiles only
   */
  resetToDefaults(): void {
    this.customProfiles.clear();
    this.currentProfile = null;
  }
}