import { BrowserContext, Page } from 'playwright';
import { Logger } from '../utils/Logger';

interface UserAgentProfile {
  userAgent: string;
  platform: string;
  vendor: string;
  language: string;
  languages: string[];
  viewport: {
    width: number;
    height: number;
  };
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}

interface RotationConfig {
  rotateOnNavigation?: boolean;
  rotateInterval?: number; // milliseconds
  weightedSelection?: boolean;
  customProfiles?: UserAgentProfile[];
  excludeProfiles?: string[];
  preferredBrowser?: 'chrome' | 'firefox' | 'safari' | 'edge';
}

export class UserAgentRotator {
  private logger: Logger;
  private profiles: Map<string, UserAgentProfile> = new Map();
  private activeProfiles: Map<string, UserAgentProfile> = new Map();
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();
  private usageStats: Map<string, number> = new Map();

  constructor() {
    this.logger = new Logger('UserAgentRotator');
    this.initializeProfiles();
  }

  private initializeProfiles(): void {
    // Desktop Chrome profiles
    this.profiles.set('chrome-windows-latest', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      language: 'en-US',
      languages: ['en-US', 'en'],
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    });

    this.profiles.set('chrome-mac-latest', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      vendor: 'Google Inc.',
      language: 'en-US',
      languages: ['en-US', 'en'],
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false
    });

    this.profiles.set('chrome-linux-latest', {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Linux x86_64',
      vendor: 'Google Inc.',
      language: 'en-US',
      languages: ['en-US', 'en'],
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    });

    // Desktop Firefox profiles
    this.profiles.set('firefox-windows-latest', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      platform: 'Win32',
      vendor: '',
      language: 'en-US',
      languages: ['en-US', 'en'],
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    });

    this.profiles.set('firefox-mac-latest', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.2) Gecko/20100101 Firefox/121.0',
      platform: 'MacIntel',
      vendor: '',
      language: 'en-US',
      languages: ['en-US', 'en'],
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false
    });

    // Desktop Safari profiles
    this.profiles.set('safari-mac-latest', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      platform: 'MacIntel',
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      languages: ['en-US'],
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false
    });

    // Desktop Edge profiles
    this.profiles.set('edge-windows-latest', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      platform: 'Win32',
      vendor: 'Google Inc.',
      language: 'en-US',
      languages: ['en-US', 'en'],
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    });

    // Mobile Chrome profiles
    this.profiles.set('chrome-android-latest', {
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      platform: 'Linux armv81',
      vendor: 'Google Inc.',
      language: 'en-US',
      languages: ['en-US', 'en'],
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true
    });

    this.profiles.set('chrome-ios-latest', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      languages: ['en-US'],
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });

    // Mobile Safari profiles
    this.profiles.set('safari-ios-latest', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      languages: ['en-US'],
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });

    // Tablet profiles
    this.profiles.set('safari-ipad-latest', {
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      platform: 'iPad',
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      languages: ['en-US'],
      viewport: { width: 1024, height: 1366 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });

    this.profiles.set('chrome-tablet-latest', {
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Linux armv81',
      vendor: 'Google Inc.',
      language: 'en-US',
      languages: ['en-US', 'en'],
      viewport: { width: 810, height: 1080 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
  }

  public selectRandomProfile(config: RotationConfig = {}): UserAgentProfile {
    let availableProfiles = Array.from(this.profiles.entries());

    // Filter by preferred browser
    if (config.preferredBrowser) {
      availableProfiles = availableProfiles.filter(([key]) => 
        key.includes(config.preferredBrowser!));
    }

    // Exclude specific profiles
    if (config.excludeProfiles?.length) {
      availableProfiles = availableProfiles.filter(([key]) => 
        !config.excludeProfiles!.includes(key));
    }

    // Add custom profiles
    if (config.customProfiles?.length) {
      config.customProfiles.forEach((profile, index) => {
        availableProfiles.push([`custom-${index}`, profile]);
      });
    }

    if (availableProfiles.length === 0) {
      throw new Error('No user agent profiles available after filtering');
    }

    // Weighted selection based on usage stats
    if (config.weightedSelection) {
      return this.selectWeightedProfile(availableProfiles);
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * availableProfiles.length);
    const [key, profile] = availableProfiles[randomIndex];
    
    // Update usage stats
    this.usageStats.set(key, (this.usageStats.get(key) || 0) + 1);
    
    return profile;
  }

  private selectWeightedProfile(profiles: [string, UserAgentProfile][]): UserAgentProfile {
    // Select profiles less frequently used
    const weights = profiles.map(([key]) => {
      const usage = this.usageStats.get(key) || 0;
      return 1 / (usage + 1); // Inverse weight based on usage
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < profiles.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        const [key, profile] = profiles[i];
        this.usageStats.set(key, (this.usageStats.get(key) || 0) + 1);
        return profile;
      }
    }

    return profiles[0][1];
  }

  public async applyUserAgent(
    page: Page,
    profile?: UserAgentProfile,
    config: RotationConfig = {}
  ): Promise<void> {
    const selectedProfile = profile || this.selectRandomProfile(config);
    const pageId = page.url() || 'new-page';
    
    this.activeProfiles.set(pageId, selectedProfile);

    try {
      // Set user agent and viewport
      await page.setViewportSize({
        width: selectedProfile.viewport.width,
        height: selectedProfile.viewport.height
      });

      // Override navigator properties
      await page.addInitScript((prof) => {
        Object.defineProperty(navigator, 'userAgent', {
          get: () => prof.userAgent
        });
        Object.defineProperty(navigator, 'platform', {
          get: () => prof.platform
        });
        Object.defineProperty(navigator, 'vendor', {
          get: () => prof.vendor
        });
        Object.defineProperty(navigator, 'language', {
          get: () => prof.language
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => prof.languages
        });
        
        // Override screen properties
        Object.defineProperty(window.screen, 'width', {
          get: () => prof.viewport.width
        });
        Object.defineProperty(window.screen, 'height', {
          get: () => prof.viewport.height
        });
        
        // Override touch support
        Object.defineProperty(navigator, 'maxTouchPoints', {
          get: () => prof.hasTouch ? 5 : 0
        });
      }, selectedProfile);

      // Set up rotation if configured
      if (config.rotateOnNavigation) {
        page.on('framenavigated', async () => {
          const newProfile = this.selectRandomProfile(config);
          await this.applyUserAgent(page, newProfile, config);
        });
      }

      if (config.rotateInterval && config.rotateInterval > 0) {
        this.setupRotationTimer(page, config);
      }

      this.logger.info('Applied user agent profile', {
        userAgent: selectedProfile.userAgent.substring(0, 50) + '...',
        platform: selectedProfile.platform,
        isMobile: selectedProfile.isMobile
      });

    } catch (error) {
      this.logger.error('Failed to apply user agent', error);
      throw error;
    }
  }

  private setupRotationTimer(page: Page, config: RotationConfig): void {
    const pageId = page.url() || 'new-page';
    
    // Clear existing timer
    if (this.rotationTimers.has(pageId)) {
      clearInterval(this.rotationTimers.get(pageId)!);
    }

    // Set up new timer
    const timer = setInterval(async () => {
      try {
        const newProfile = this.selectRandomProfile(config);
        await this.applyUserAgent(page, newProfile, config);
        this.logger.debug('Rotated user agent on timer', {
          pageId,
          interval: config.rotateInterval
        });
      } catch (error) {
        this.logger.error('Failed to rotate user agent on timer', error);
      }
    }, config.rotateInterval!);

    this.rotationTimers.set(pageId, timer);

    // Clean up timer when page closes
    page.on('close', () => {
      if (this.rotationTimers.has(pageId)) {
        clearInterval(this.rotationTimers.get(pageId)!);
        this.rotationTimers.delete(pageId);
      }
    });
  }

  public async applyToContext(
    context: BrowserContext,
    config: RotationConfig = {}
  ): Promise<void> {
    const profile = this.selectRandomProfile(config);

    // Note: User agent and viewport should be set when creating the context
    // using newContext({ userAgent: ..., viewport: ... })
    // We can only apply to pages created within this context

    // Apply to all new pages
    context.on('page', async (page) => {
      await this.applyUserAgent(page, undefined, config);
    });

    this.logger.info('Applied user agent rotation to context', {
      defaultProfile: profile.userAgent.substring(0, 50) + '...'
    });
  }

  public getActiveProfile(pageUrl: string): UserAgentProfile | undefined {
    return this.activeProfiles.get(pageUrl);
  }

  public getUsageStatistics(): Map<string, number> {
    return new Map(this.usageStats);
  }

  public resetUsageStatistics(): void {
    this.usageStats.clear();
    this.logger.info('Reset user agent usage statistics');
  }

  public async validateUserAgent(page: Page): Promise<{
    isValid: boolean;
    detected: {
      userAgent: string;
      platform: string;
      vendor: string;
      languages: string[];
    };
    expected?: UserAgentProfile;
  }> {
    const pageId = page.url() || 'new-page';
    const expected = this.activeProfiles.get(pageId);

    const detected = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      languages: navigator.languages,
      language: navigator.language,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height
      },
      touchPoints: navigator.maxTouchPoints
    }));

    const isValid = expected ? 
      detected.userAgent === expected.userAgent &&
      detected.platform === expected.platform &&
      detected.vendor === expected.vendor : false;

    return {
      isValid,
      detected: {
        userAgent: detected.userAgent,
        platform: detected.platform,
        vendor: detected.vendor,
        languages: [...detected.languages]
      },
      expected
    };
  }

  public generateUserAgentString(
    browser: 'chrome' | 'firefox' | 'safari' | 'edge',
    platform: 'windows' | 'mac' | 'linux' | 'android' | 'ios',
    version?: string
  ): string {
    const templates: { [key: string]: string } = {
      'chrome-windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36',
      'chrome-mac': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36',
      'chrome-linux': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36',
      'chrome-android': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Mobile Safari/537.36',
      'firefox-windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:{version}) Gecko/20100101 Firefox/{version}',
      'firefox-mac': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.2) Gecko/20100101 Firefox/{version}',
      'safari-mac': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{version} Safari/605.1.15',
      'safari-ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{version} Mobile/15E148 Safari/604.1',
      'edge-windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36 Edg/{version}'
    };

    const key = `${browser}-${platform}`;
    const template = templates[key];
    
    if (!template) {
      throw new Error(`No template for ${browser} on ${platform}`);
    }

    const defaultVersion = browser === 'chrome' || browser === 'edge' ? '120.0.0.0' : 
                          browser === 'firefox' ? '121.0' : '17.2';
    
    return template.replace(/{version}/g, version || defaultVersion);
  }

  public cleanup(): void {
    // Clear all rotation timers
    this.rotationTimers.forEach(timer => clearInterval(timer));
    this.rotationTimers.clear();
    this.activeProfiles.clear();
    this.logger.info('Cleaned up user agent rotator');
  }
}