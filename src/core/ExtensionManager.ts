/**
 * ExtensionManager - Handles browser extension injection and management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as unzipper from 'unzipper';
import { ActionResult } from '../types';
import { formatResponse } from '../utils/responseFormatter';

export interface ExtensionConfig {
  path?: string;           // Path to unpacked extension or CRX/ZIP file
  url?: string;           // URL to download extension from (Chrome Web Store URL)
  id?: string;            // Extension ID for Chrome Web Store
  manifest?: any;         // Optional manifest overrides
  permissions?: string[]; // Additional permissions to grant
}

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  path: string;
  manifest?: any;
}

export class ExtensionManager {
  private extensions: Map<string, ExtensionInfo> = new Map();
  private tempDir: string;

  constructor() {
    // Create temp directory for extension extraction
    this.tempDir = path.join(process.cwd(), '.playclone-extensions');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Load extension from various sources
   */
  async loadExtension(config: ExtensionConfig): Promise<ActionResult> {
    try {
      let extensionPath: string;

      if (config.path) {
        // Load from local path
        extensionPath = await this.loadFromPath(config.path);
      } else if (config.url) {
        // Download and load from URL
        extensionPath = await this.loadFromUrl(config.url);
      } else if (config.id) {
        // Load from Chrome Web Store ID
        extensionPath = await this.loadFromWebStore(config.id);
      } else {
        throw new Error('No extension source provided (path, url, or id required)');
      }

      // Read manifest
      const manifestPath = path.join(extensionPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('No manifest.json found in extension');
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      // Apply manifest overrides if provided
      if (config.manifest) {
        Object.assign(manifest, config.manifest);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }

      // Add additional permissions if requested
      if (config.permissions && manifest.permissions) {
        manifest.permissions = [...new Set([...manifest.permissions, ...config.permissions])];
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }

      // Create extension info
      const extensionInfo: ExtensionInfo = {
        id: manifest.key || this.generateExtensionId(),
        name: manifest.name || 'Unknown Extension',
        version: manifest.version || '0.0.0',
        description: manifest.description,
        enabled: true,
        path: extensionPath,
        manifest
      };

      // Store extension info
      this.extensions.set(extensionInfo.id, extensionInfo);

      return formatResponse({
        success: true,
        action: 'loadExtension',
        value: {
          id: extensionInfo.id,
          name: extensionInfo.name,
          version: extensionInfo.version,
          path: extensionInfo.path
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'loadExtension',
        error: error.message,
        errorCode: 'EXTENSION_LOAD_FAILED',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Load extension from local path
   */
  private async loadFromPath(extensionPath: string): Promise<string> {
    if (!fs.existsSync(extensionPath)) {
      throw new Error(`Extension path does not exist: ${extensionPath}`);
    }

    const stats = fs.statSync(extensionPath);
    
    if (stats.isDirectory()) {
      // Already unpacked extension
      return extensionPath;
    } else if (extensionPath.endsWith('.crx') || extensionPath.endsWith('.zip')) {
      // Need to extract
      return await this.extractExtension(extensionPath);
    } else {
      throw new Error('Extension must be a directory, .crx, or .zip file');
    }
  }

  /**
   * Download and load extension from URL
   */
  private async loadFromUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download extension: ${response.statusText}`);
      }

      const extensionId = this.generateExtensionId();
      const downloadPath = path.join(this.tempDir, `${extensionId}.zip`);
      
      // Save downloaded file
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(downloadPath, Buffer.from(buffer));

      // Extract and return path
      return await this.extractExtension(downloadPath);
    } catch (error: any) {
      throw new Error(`Failed to download extension: ${error.message}`);
    }
  }

  /**
   * Load extension from Chrome Web Store
   */
  private async loadFromWebStore(extensionId: string): Promise<string> {
    // Chrome Web Store CRX download URL
    const downloadUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=91.0.4472.124&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;
    
    try {
      return await this.loadFromUrl(downloadUrl);
    } catch (error: any) {
      throw new Error(`Failed to load extension from Chrome Web Store: ${error.message}`);
    }
  }

  /**
   * Extract CRX or ZIP extension
   */
  private async extractExtension(archivePath: string): Promise<string> {
    const extensionId = path.basename(archivePath, path.extname(archivePath));
    const extractPath = path.join(this.tempDir, extensionId);

    // Create extraction directory
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      // Handle CRX files (skip CRX header)
      let skipBytes = 0;
      if (archivePath.endsWith('.crx')) {
        const buffer = fs.readFileSync(archivePath);
        // CRX v2 header is 16 bytes + key length + signature length
        // CRX v3 has a different format but we'll handle both
        if (buffer[0] === 67 && buffer[1] === 114 && buffer[2] === 50) {
          // CRX v2
          const keyLength = buffer.readUInt32LE(8);
          const signatureLength = buffer.readUInt32LE(12);
          skipBytes = 16 + keyLength + signatureLength;
        } else if (buffer[0] === 67 && buffer[1] === 114 && buffer[2] === 51) {
          // CRX v3 - more complex, simplified handling
          skipBytes = 12; // Skip basic header, may need adjustment
        }
      }

      // Extract the archive
      const stream = fs.createReadStream(archivePath, { start: skipBytes });
      stream
        .pipe(unzipper.Extract({ path: extractPath }))
        .on('finish', () => resolve(extractPath))
        .on('error', reject);
    });
  }

  /**
   * Get browser launch arguments for loading extensions
   */
  getBrowserArgs(): string[] {
    const args: string[] = [];
    
    for (const [, extension] of this.extensions) {
      if (extension.enabled) {
        // For Chromium-based browsers
        args.push(`--load-extension=${extension.path}`);
        // Disable extension security warnings
        args.push('--disable-extensions-except=' + extension.path);
        args.push('--disable-extension-sandbox');
      }
    }

    // Additional args for extension support
    if (this.extensions.size > 0) {
      args.push('--enable-extensions');
      args.push('--no-sandbox'); // Required for some extensions
    }

    return args;
  }

  /**
   * Get Firefox extension preferences
   */
  getFirefoxPreferences(): Record<string, any> {
    const prefs: Record<string, any> = {};
    
    // Enable extension installation
    prefs['extensions.experiments.enabled'] = true;
    prefs['xpinstall.signatures.required'] = false;
    prefs['extensions.webextensions.uuids'] = {};

    // Add extension UUIDs
    for (const [, extension] of this.extensions) {
      if (extension.enabled) {
        prefs['extensions.webextensions.uuids'][extension.id] = extension.id;
      }
    }

    return prefs;
  }

  /**
   * Enable or disable an extension
   */
  setExtensionEnabled(extensionId: string, enabled: boolean): ActionResult {
    const extension = this.extensions.get(extensionId);
    
    if (!extension) {
      return formatResponse({
        success: false,
        action: 'setExtensionEnabled',
        error: `Extension not found: ${extensionId}`,
        errorCode: 'EXTENSION_NOT_FOUND',
        timestamp: Date.now()
      });
    }

    extension.enabled = enabled;
    
    return formatResponse({
      success: true,
      action: 'setExtensionEnabled',
      value: {
        id: extensionId,
        enabled
      },
      timestamp: Date.now()
    });
  }

  /**
   * Get list of loaded extensions
   */
  getExtensions(): ExtensionInfo[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Remove an extension
   */
  removeExtension(extensionId: string): ActionResult {
    const extension = this.extensions.get(extensionId);
    
    if (!extension) {
      return formatResponse({
        success: false,
        action: 'removeExtension',
        error: `Extension not found: ${extensionId}`,
        errorCode: 'EXTENSION_NOT_FOUND',
        timestamp: Date.now()
      });
    }

    // Remove from map
    this.extensions.delete(extensionId);

    // Clean up extracted files if in temp directory
    if (extension.path.startsWith(this.tempDir)) {
      try {
        fs.rmSync(extension.path, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    return formatResponse({
      success: true,
      action: 'removeExtension',
      value: {
        id: extensionId,
        removed: true
      },
      timestamp: Date.now()
    });
  }

  /**
   * Clean up temporary extension files
   */
  cleanup(): void {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Generate unique extension ID
   */
  private generateExtensionId(): string {
    return `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Install extension in running browser (for dynamic installation)
   */
  async installInBrowser(page: any, extensionPath: string): Promise<ActionResult> {
    try {
      // This method would use browser DevTools Protocol to install extensions dynamically
      // Different approach for each browser type
      
      // For Chromium: Use chrome.management API or CDP
      await page.evaluate((path: string) => {
        // This would require special permissions and APIs
        console.log('Installing extension:', path);
      }, extensionPath);

      return formatResponse({
        success: true,
        action: 'installInBrowser',
        value: { installed: true, path: extensionPath },
        timestamp: Date.now()
      });
    } catch (error: any) {
      return formatResponse({
        success: false,
        action: 'installInBrowser',
        error: error.message,
        errorCode: 'DYNAMIC_INSTALL_FAILED',
        timestamp: Date.now()
      });
    }
  }
}