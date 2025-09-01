import { Page, BrowserContext } from 'playwright';
import { Logger } from '../utils/Logger';

interface FingerprintConfig {
  randomizeCanvas?: boolean;
  randomizeWebGL?: boolean;
  randomizeAudioContext?: boolean;
  randomizeClientRects?: boolean;
  randomizeScreenResolution?: boolean;
  randomizeTimezone?: boolean;
  randomizeLanguages?: boolean;
  randomizeHardwareConcurrency?: boolean;
  randomizeDeviceMemory?: boolean;
  customFingerprint?: Partial<FingerprintProfile>;
}

interface FingerprintProfile {
  canvas: {
    noise: number;
    shift: number;
  };
  webgl: {
    vendor: string;
    renderer: string;
  };
  audio: {
    sampleRate: number;
    channelCount: number;
  };
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
  };
  timezone: string;
  languages: string[];
  hardwareConcurrency: number;
  deviceMemory: number;
  platform: string;
  vendor: string;
}

export class FingerprintRandomizer {
  private logger: Logger;
  private profiles: Map<string, FingerprintProfile> = new Map();
  private activeFingerprints: Map<string, FingerprintProfile> = new Map();

  constructor() {
    this.logger = new Logger('FingerprintRandomizer');
    this.initializeProfiles();
  }

  private initializeProfiles(): void {
    // Common browser fingerprint profiles
    this.profiles.set('chrome-windows', {
      canvas: { noise: 0.02, shift: 1 },
      webgl: {
        vendor: 'Google Inc. (Intel)',
        renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)'
      },
      audio: { sampleRate: 48000, channelCount: 2 },
      screen: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
        colorDepth: 24,
        pixelDepth: 24
      },
      timezone: 'America/New_York',
      languages: ['en-US', 'en'],
      hardwareConcurrency: 8,
      deviceMemory: 8,
      platform: 'Win32',
      vendor: 'Google Inc.'
    });

    this.profiles.set('firefox-mac', {
      canvas: { noise: 0.01, shift: 2 },
      webgl: {
        vendor: 'Apple Inc.',
        renderer: 'Apple M1'
      },
      audio: { sampleRate: 44100, channelCount: 2 },
      screen: {
        width: 2560,
        height: 1600,
        availWidth: 2560,
        availHeight: 1555,
        colorDepth: 30,
        pixelDepth: 30
      },
      timezone: 'America/Los_Angeles',
      languages: ['en-US', 'en'],
      hardwareConcurrency: 8,
      deviceMemory: 16,
      platform: 'MacIntel',
      vendor: ''
    });

    this.profiles.set('safari-ios', {
      canvas: { noise: 0.03, shift: 0 },
      webgl: {
        vendor: 'Apple Inc.',
        renderer: 'Apple GPU'
      },
      audio: { sampleRate: 44100, channelCount: 2 },
      screen: {
        width: 414,
        height: 896,
        availWidth: 414,
        availHeight: 896,
        colorDepth: 32,
        pixelDepth: 32
      },
      timezone: 'America/Chicago',
      languages: ['en-US'],
      hardwareConcurrency: 6,
      deviceMemory: 4,
      platform: 'iPhone',
      vendor: 'Apple Computer, Inc.'
    });
  }

  public generateRandomProfile(): FingerprintProfile {
    const baseProfiles = Array.from(this.profiles.values());
    const base = baseProfiles[Math.floor(Math.random() * baseProfiles.length)];
    
    // Add random variations
    return {
      ...base,
      canvas: {
        noise: base.canvas.noise + (Math.random() * 0.01 - 0.005),
        shift: base.canvas.shift + Math.floor(Math.random() * 3 - 1)
      },
      screen: {
        ...base.screen,
        width: base.screen.width + Math.floor(Math.random() * 20 - 10),
        height: base.screen.height + Math.floor(Math.random() * 20 - 10)
      },
      hardwareConcurrency: Math.max(2, Math.min(16, 
        base.hardwareConcurrency + Math.floor(Math.random() * 4 - 2))),
      deviceMemory: Math.max(2, Math.min(32,
        base.deviceMemory + Math.floor(Math.random() * 4 - 2)))
    };
  }

  public async applyFingerprint(
    page: Page,
    config: FingerprintConfig = {}
  ): Promise<void> {
    const profile = config.customFingerprint 
      ? { ...this.generateRandomProfile(), ...config.customFingerprint }
      : this.generateRandomProfile();

    const pageId = page.url();
    this.activeFingerprints.set(pageId, profile);

    try {
      await page.addInitScript(() => {
        // Canvas fingerprinting protection
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        (HTMLCanvasElement.prototype as any).getContext = function(type: any, ...args: any[]) {
          const context = originalGetContext.apply(this, [type, ...args] as any);
          
          if (type === '2d' && context && 'getImageData' in context) {
            const originalGetImageData = (context as CanvasRenderingContext2D).getImageData;
            (context as any).getImageData = function(sx: number, sy: number, sw: number, sh: number, settings?: any) {
              const imageData = originalGetImageData.apply(this, [sx, sy, sw, sh, settings]);
              
              // Add noise to canvas fingerprint
              const data = imageData.data;
              for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, data[i] + Math.random() * 2);
                data[i + 1] = Math.min(255, data[i + 1] + Math.random() * 2);
                data[i + 2] = Math.min(255, data[i + 2] + Math.random() * 2);
              }
              
              return imageData;
            };
          }
          
          return context;
        };
      });

      // WebGL fingerprinting protection
      if (config.randomizeWebGL !== false) {
        await page.addInitScript((fp) => {
          const getParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
            if (parameter === 37445) return fp.webgl.vendor;
            if (parameter === 37446) return fp.webgl.renderer;
            return getParameter.apply(this, [parameter]);
          };

          if (typeof WebGL2RenderingContext !== 'undefined') {
            const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
            WebGL2RenderingContext.prototype.getParameter = function(parameter: number) {
              if (parameter === 37445) return fp.webgl.vendor;
              if (parameter === 37446) return fp.webgl.renderer;
              return getParameter2.apply(this, [parameter]);
            };
          }
        }, profile);
      }

      // Audio context fingerprinting protection
      if (config.randomizeAudioContext !== false) {
        await page.addInitScript((fp) => {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (typeof AudioContext !== 'undefined') {
            const OriginalAudioContext = AudioContext;
            (window as any).AudioContext = function(...args: any[]) {
              const context = new OriginalAudioContext(...args);
              Object.defineProperty(context, 'sampleRate', {
                get: () => fp.audio.sampleRate
              });
              return context;
            };
          }
        }, profile);
      }

      // Screen resolution fingerprinting protection
      if (config.randomizeScreenResolution !== false) {
        await page.addInitScript((fp) => {
          Object.defineProperty(window.screen, 'width', { get: () => fp.screen.width });
          Object.defineProperty(window.screen, 'height', { get: () => fp.screen.height });
          Object.defineProperty(window.screen, 'availWidth', { get: () => fp.screen.availWidth });
          Object.defineProperty(window.screen, 'availHeight', { get: () => fp.screen.availHeight });
          Object.defineProperty(window.screen, 'colorDepth', { get: () => fp.screen.colorDepth });
          Object.defineProperty(window.screen, 'pixelDepth', { get: () => fp.screen.pixelDepth });
        }, profile);
      }

      // Hardware concurrency randomization
      if (config.randomizeHardwareConcurrency !== false) {
        await page.addInitScript((fp) => {
          Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => fp.hardwareConcurrency
          });
        }, profile);
      }

      // Device memory randomization
      if (config.randomizeDeviceMemory !== false) {
        await page.addInitScript((fp) => {
          Object.defineProperty(navigator, 'deviceMemory', {
            get: () => fp.deviceMemory
          });
        }, profile);
      }

      // Language randomization
      if (config.randomizeLanguages !== false) {
        await page.addInitScript((fp) => {
          Object.defineProperty(navigator, 'languages', {
            get: () => fp.languages
          });
          Object.defineProperty(navigator, 'language', {
            get: () => fp.languages[0]
          });
        }, profile);
      }

      // Platform randomization
      await page.addInitScript((fp) => {
        Object.defineProperty(navigator, 'platform', {
          get: () => fp.platform
        });
        Object.defineProperty(navigator, 'vendor', {
          get: () => fp.vendor
        });
      }, profile);

      // Client rects noise
      if (config.randomizeClientRects !== false) {
        await page.addInitScript(() => {
          const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
          Element.prototype.getBoundingClientRect = function() {
            const rect = originalGetBoundingClientRect.apply(this);
            const noise = () => Math.random() * 0.1 - 0.05;
            
            return {
              ...rect,
              x: rect.x + noise(),
              y: rect.y + noise(),
              width: rect.width + noise(),
              height: rect.height + noise(),
              top: rect.top + noise(),
              right: rect.right + noise(),
              bottom: rect.bottom + noise(),
              left: rect.left + noise()
            };
          };
        });
      }

      this.logger.info('Applied fingerprint randomization', {
        profileType: profile.platform,
        features: Object.keys(config).filter(k => config[k as keyof FingerprintConfig])
      });

    } catch (error) {
      this.logger.error('Failed to apply fingerprint randomization', error);
      throw error;
    }
  }

  public async applyToContext(
    context: BrowserContext,
    config: FingerprintConfig = {}
  ): Promise<void> {
    // Apply timezone if configured
    if (config.randomizeTimezone !== false) {
      const profile = this.generateRandomProfile();
      await context.addInitScript(() => {
        const originalDate = Date;
        
        // Override Date constructor to use custom timezone
        (window as any).Date = new Proxy(originalDate, {
          construct(target, args: any[]) {
            const instance = new (target as any)(...args);
            // Add timezone offset manipulation here
            return instance;
          }
        });
      });
    }

    // Apply to all new pages in context
    context.on('page', async (page) => {
      await this.applyFingerprint(page, config);
    });
  }

  public rotateFingerprint(page: Page): Promise<void> {
    return this.applyFingerprint(page, {
      randomizeCanvas: true,
      randomizeWebGL: true,
      randomizeAudioContext: true,
      randomizeScreenResolution: true,
      randomizeHardwareConcurrency: true,
      randomizeDeviceMemory: true,
      randomizeLanguages: true
    });
  }

  public getActiveFingerprint(pageUrl: string): FingerprintProfile | undefined {
    return this.activeFingerprints.get(pageUrl);
  }

  public clearFingerprint(pageUrl: string): void {
    this.activeFingerprints.delete(pageUrl);
  }

  public async validateFingerprint(page: Page): Promise<{
    isValid: boolean;
    detectedFingerprint: Partial<FingerprintProfile>;
    appliedFingerprint?: FingerprintProfile;
  }> {
    const pageUrl = page.url();
    const applied = this.activeFingerprints.get(pageUrl);

    const detected = await page.evaluate(() => {
      return {
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          availWidth: window.screen.availWidth,
          availHeight: window.screen.availHeight,
          colorDepth: window.screen.colorDepth,
          pixelDepth: window.screen.pixelDepth
        },
        languages: [...navigator.languages],
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory,
        platform: navigator.platform,
        vendor: navigator.vendor
      };
    });

    const isValid = applied ? 
      JSON.stringify(detected) !== JSON.stringify({
        screen: {
          width: applied.screen.width,
          height: applied.screen.height,
          colorDepth: applied.screen.colorDepth
        },
        languages: applied.languages,
        hardwareConcurrency: applied.hardwareConcurrency,
        deviceMemory: applied.deviceMemory,
        platform: applied.platform,
        vendor: applied.vendor
      }) : false;

    return {
      isValid,
      detectedFingerprint: detected,
      appliedFingerprint: applied
    };
  }
}