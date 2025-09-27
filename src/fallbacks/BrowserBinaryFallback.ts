/**
 * BrowserBinaryFallback - Fallback strategies for browser binary management
 * 
 * Handles scenarios where Playwright browser binaries are unavailable:
 * - CDN failures
 * - Network restrictions
 * - Offline environments
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/Logger';

const execAsync = promisify(exec);

interface BrowserPath {
  browser: 'chromium' | 'firefox' | 'webkit';
  executablePath: string;
  version?: string;
  isSystem: boolean;
}

export class BrowserBinaryFallback {
  private readonly logger = new Logger('BrowserBinaryFallback');
  private readonly cacheDir: string;
  private cachedPaths: Map<string, BrowserPath> = new Map();

  constructor() {
    this.cacheDir = path.join(os.homedir(), '.playclone', 'browsers');
    this.ensureCacheDirectory();
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Find browser executable with fallback strategies
   */
  async findBrowserExecutable(browser: 'chromium' | 'firefox' | 'webkit'): Promise<BrowserPath | null> {
    // Check cache first
    const cached = this.cachedPaths.get(browser);
    if (cached && fs.existsSync(cached.executablePath)) {
      return cached;
    }

    // Strategy 1: Check Playwright installation
    const playwrightPath = await this.checkPlaywrightBrowser(browser);
    if (playwrightPath) {
      return playwrightPath;
    }

    // Strategy 2: Check system installation
    const systemPath = await this.checkSystemBrowser(browser);
    if (systemPath) {
      return systemPath;
    }

    // Strategy 3: Check common installation paths
    const commonPath = await this.checkCommonPaths(browser);
    if (commonPath) {
      return commonPath;
    }

    // Strategy 4: Try to use portable browser from cache
    const portablePath = await this.checkPortableBrowser(browser);
    if (portablePath) {
      return portablePath;
    }

    // Strategy 5: Suggest alternatives
    this.logger.warn(`No ${browser} browser found. Suggesting alternatives...`);
    return await this.suggestAlternative(browser);
  }

  /**
   * Check for Playwright-installed browsers
   */
  private async checkPlaywrightBrowser(browser: string): Promise<BrowserPath | null> {
    try {
      const playwrightPath = path.join(
        os.homedir(),
        '.cache',
        'ms-playwright'
      );

      if (!fs.existsSync(playwrightPath)) {
        return null;
      }

      const browserDirs = fs.readdirSync(playwrightPath)
        .filter(dir => dir.toLowerCase().includes(browser));

      for (const dir of browserDirs) {
        const browserPath = path.join(playwrightPath, dir);
        const executable = await this.findExecutableInDir(browserPath, browser);
        if (executable) {
          const result: BrowserPath = {
            browser: browser as any,
            executablePath: executable,
            version: dir,
            isSystem: false
          };
          this.cachedPaths.set(browser, result);
          return result;
        }
      }
    } catch (error) {
      this.logger.debug(`Playwright browser check failed: ${error}`);
    }
    return null;
  }

  /**
   * Check for system-installed browsers
   */
  private async checkSystemBrowser(browser: string): Promise<BrowserPath | null> {
    const commands: Record<string, string[]> = {
      chromium: ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'],
      firefox: ['firefox', 'firefox-esr'],
      webkit: ['webkit2gtk', 'epiphany', 'minibrowser']
    };

    const browserCommands = commands[browser] || [];
    
    for (const cmd of browserCommands) {
      try {
        const { stdout } = await execAsync(`which ${cmd}`);
        const execPath = stdout.trim();
        if (execPath) {
          const result: BrowserPath = {
            browser: browser as any,
            executablePath: execPath,
            isSystem: true
          };
          
          // Try to get version
          try {
            const { stdout: versionOut } = await execAsync(`${cmd} --version`);
            result.version = versionOut.trim();
          } catch {}
          
          this.cachedPaths.set(browser, result);
          return result;
        }
      } catch {
        // Command not found, continue
      }
    }
    
    return null;
  }

  /**
   * Check common installation paths
   */
  private async checkCommonPaths(browser: string): Promise<BrowserPath | null> {
    const platform = os.platform();
    let paths: string[] = [];

    if (platform === 'darwin') {
      paths = this.getMacPaths(browser);
    } else if (platform === 'win32') {
      paths = this.getWindowsPaths(browser);
    } else {
      paths = this.getLinuxPaths(browser);
    }

    for (const p of paths) {
      if (fs.existsSync(p)) {
        const result: BrowserPath = {
          browser: browser as any,
          executablePath: p,
          isSystem: true
        };
        this.cachedPaths.set(browser, result);
        return result;
      }
    }

    return null;
  }

  /**
   * Get Mac browser paths
   */
  private getMacPaths(browser: string): string[] {
    const paths: Record<string, string[]> = {
      chromium: [
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
      ],
      firefox: [
        '/Applications/Firefox.app/Contents/MacOS/firefox',
        '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
        '/Applications/Firefox Nightly.app/Contents/MacOS/firefox'
      ],
      webkit: [
        '/Applications/Safari.app/Contents/MacOS/Safari',
        '/Applications/WebKit.app/Contents/MacOS/WebKit'
      ]
    };
    return paths[browser] || [];
  }

  /**
   * Get Windows browser paths
   */
  private getWindowsPaths(browser: string): string[] {
    const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    
    const paths: Record<string, string[]> = {
      chromium: [
        `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
        `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
        `${programFiles}\\Chromium\\Application\\chrome.exe`
      ],
      firefox: [
        `${programFiles}\\Mozilla Firefox\\firefox.exe`,
        `${programFilesX86}\\Mozilla Firefox\\firefox.exe`,
        `${programFiles}\\Firefox Developer Edition\\firefox.exe`
      ],
      webkit: [
        // WebKit is not commonly available on Windows
      ]
    };
    return paths[browser] || [];
  }

  /**
   * Get Linux browser paths
   */
  private getLinuxPaths(browser: string): string[] {
    const paths: Record<string, string[]> = {
      chromium: [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/snap/bin/chromium',
        '/opt/google/chrome/chrome'
      ],
      firefox: [
        '/usr/bin/firefox',
        '/usr/bin/firefox-esr',
        '/snap/bin/firefox',
        '/opt/firefox/firefox'
      ],
      webkit: [
        '/usr/bin/webkit2gtk',
        '/usr/bin/epiphany',
        '/usr/bin/minibrowser'
      ]
    };
    return paths[browser] || [];
  }

  /**
   * Check for portable browser in cache
   */
  private async checkPortableBrowser(browser: string): Promise<BrowserPath | null> {
    const portablePath = path.join(this.cacheDir, browser);
    if (fs.existsSync(portablePath)) {
      const executable = await this.findExecutableInDir(portablePath, browser);
      if (executable) {
        return {
          browser: browser as any,
          executablePath: executable,
          isSystem: false
        };
      }
    }
    return null;
  }

  /**
   * Find executable in directory
   */
  private async findExecutableInDir(dir: string, browser: string): Promise<string | null> {
    const patterns: Record<string, string[]> = {
      chromium: ['chrome', 'chromium', 'Chromium'],
      firefox: ['firefox', 'Firefox'],
      webkit: ['webkit', 'WebKit', 'MiniBrowser']
    };

    const searchPatterns = patterns[browser] || [];
    
    const findExecutable = (currentDir: string): string | null => {
      if (!fs.existsSync(currentDir)) return null;
      
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          for (const pattern of searchPatterns) {
            if (file.toLowerCase().includes(pattern.toLowerCase())) {
              // Check if executable
              try {
                fs.accessSync(fullPath, fs.constants.X_OK);
                return fullPath;
              } catch {
                // Not executable
              }
            }
          }
        } else if (stat.isDirectory() && !file.startsWith('.')) {
          const found = findExecutable(fullPath);
          if (found) return found;
        }
      }
      
      return null;
    };

    return findExecutable(dir);
  }

  /**
   * Suggest alternative browser
   */
  private async suggestAlternative(requestedBrowser: string): Promise<BrowserPath | null> {
    const alternatives = ['chromium', 'firefox', 'webkit'].filter(b => b !== requestedBrowser);
    
    for (const alt of alternatives) {
      const path = await this.checkSystemBrowser(alt);
      if (path) {
        this.logger.info(`Using ${alt} as alternative to ${requestedBrowser}`);
        return path;
      }
    }
    
    return null;
  }

  /**
   * Download browser if possible (requires internet)
   */
  async downloadBrowser(browser: string): Promise<boolean> {
    try {
      this.logger.info(`Attempting to download ${browser}...`);
      
      // Try using npx playwright install
      const { stdout, stderr } = await execAsync(`npx playwright install ${browser}`);
      
      if (stderr && !stderr.includes('Success')) {
        this.logger.error(`Failed to download ${browser}: ${stderr}`);
        return false;
      }
      
      this.logger.info(`Successfully downloaded ${browser}`);
      return true;
    } catch (error) {
      this.logger.error(`Error downloading ${browser}: ${error}`);
      return false;
    }
  }

  /**
   * Get browser recommendations
   */
  getRecommendations(): string[] {
    return [
      'Install Chromium for best compatibility: sudo apt-get install chromium-browser',
      'Install Firefox as alternative: sudo apt-get install firefox',
      'Use npx playwright install to download browsers',
      'Set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 to skip downloads',
      'Use system browsers with --browser-executable-path option'
    ];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedPaths.clear();
  }
}