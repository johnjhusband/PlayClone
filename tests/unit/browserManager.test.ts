import { BrowserManager } from '../../src/core/BrowserManager';
import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright-core';

// Mock playwright-core
jest.mock('playwright-core', () => ({
  chromium: {
    launch: jest.fn()
  },
  firefox: {
    launch: jest.fn()
  },
  webkit: {
    launch: jest.fn()
  }
}));

describe('BrowserManager', () => {
  let browserManager: BrowserManager;
  let mockBrowser: jest.Mocked<Browser>;
  let mockContext: jest.Mocked<BrowserContext>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    // Setup mock page
    mockPage = {
      goto: jest.fn(),
      close: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
      title: jest.fn().mockResolvedValue('Test Page')
    } as any;

    // Setup mock browser and context
    mockContext = {
      close: jest.fn(),
      newPage: jest.fn().mockResolvedValue(mockPage),
      pages: jest.fn().mockReturnValue([]),
      setDefaultTimeout: jest.fn(),
      setDefaultNavigationTimeout: jest.fn(),
      addCookies: jest.fn(),
      clearCookies: jest.fn(),
      grantPermissions: jest.fn(),
      clearPermissions: jest.fn(),
      setGeolocation: jest.fn(),
      setExtraHTTPHeaders: jest.fn(),
      setOffline: jest.fn(),
      addInitScript: jest.fn(),
      exposeFunction: jest.fn(),
      route: jest.fn(),
      unroute: jest.fn(),
      waitForEvent: jest.fn(),
      storageState: jest.fn()
    } as any;

    mockBrowser = {
      close: jest.fn(),
      newContext: jest.fn().mockResolvedValue(mockContext),
      contexts: jest.fn().mockReturnValue([]),
      isConnected: jest.fn().mockReturnValue(true),
      version: jest.fn().mockReturnValue('1.0.0')
    } as any;

    // Reset all mocks
    (chromium.launch as jest.Mock).mockReset();
    (firefox.launch as jest.Mock).mockReset();
    (webkit.launch as jest.Mock).mockReset();
  });

  afterEach(async () => {
    if (browserManager) {
      await browserManager.close();
    }
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      browserManager = new BrowserManager();
      expect(browserManager).toBeTruthy();
    });

    it('should accept custom options', () => {
      browserManager = new BrowserManager({
        headless: false,
        browser: 'firefox',
        viewport: { width: 1920, height: 1080 }
      });
      expect(browserManager).toBeTruthy();
    });
  });

  describe('launch', () => {
    it('should launch chromium browser by default', async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();

      const result = await browserManager.launch();

      expect(chromium.launch).toHaveBeenCalledWith(expect.objectContaining({
        headless: true
      }));
      expect(result.success).toBe(true);
      expect(result.value).toBeDefined();
    });

    it('should launch firefox browser when specified', async () => {
      (firefox.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager({ browser: 'firefox' });

      const result = await browserManager.launch();

      expect(firefox.launch).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should launch webkit browser when specified', async () => {
      (webkit.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager({ browser: 'webkit' });

      const result = await browserManager.launch();

      expect(webkit.launch).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should create initial page after launch', async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();

      const result = await browserManager.launch();

      expect(mockContext.newPage).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should apply custom launch options', async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager({
        args: ['--no-sandbox'],
        slowMo: 100,
        devtools: true
      });

      await browserManager.launch();

      expect(chromium.launch).toHaveBeenCalledWith(expect.objectContaining({
        args: ['--no-sandbox'],
        slowMo: 100,
        devtools: true
      }));
    });

    it('should handle launch errors', async () => {
      (chromium.launch as jest.Mock).mockRejectedValue(new Error('Launch failed'));
      browserManager = new BrowserManager();

      const result = await browserManager.launch();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Launch failed');
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();
      await browserManager.launch();
    });

    it('should close browser and context', async () => {
      const result = await browserManager.close();

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle close when already closed', async () => {
      await browserManager.close();
      const result = await browserManager.close();

      expect(result.success).toBe(true);
    });

    it('should handle errors during close gracefully', async () => {
      mockBrowser.close.mockRejectedValue(new Error('Close failed'));

      const result = await browserManager.close();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Close failed');
    });
  });

  describe('getPage', () => {
    it('should return current page after launch', async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();
      await browserManager.launch();

      const page = browserManager.getPage();
      expect(page).toBe(mockPage);
    });

    it('should return null if not launched', () => {
      browserManager = new BrowserManager();
      const page = browserManager.getPage();
      expect(page).toBeNull();
    });
  });

  describe('getContext', () => {
    it('should return current context after launch', async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();
      await browserManager.launch();

      const context = browserManager.getContext();
      expect(context).toBe(mockContext);
    });

    it('should return null if not launched', () => {
      browserManager = new BrowserManager();
      const context = browserManager.getContext();
      expect(context).toBeNull();
    });
  });

  describe('navigate', () => {
    it('should navigate to URL', async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();
      await browserManager.launch();
      mockPage.goto = jest.fn().mockResolvedValue(null);

      const result = await browserManager.navigate('https://example.com');
      
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
      expect(result.success).toBe(true);
    });

    it('should handle navigation errors', async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();
      await browserManager.launch();
      mockPage.goto = jest.fn().mockRejectedValue(new Error('Navigation failed'));

      const result = await browserManager.navigate('https://example.com');
      expect(result.success).toBe(false);
    });
  });

  describe('back', () => {
    it('should navigate back', async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();
      await browserManager.launch();
      mockPage.goBack = jest.fn().mockResolvedValue(null);

      const result = await browserManager.back();
      
      expect(mockPage.goBack).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('forward', () => {
    it('should navigate forward', async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();
      await browserManager.launch();
      mockPage.goForward = jest.fn().mockResolvedValue(null);

      const result = await browserManager.forward();
      
      expect(mockPage.goForward).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('reload', () => {
    it('should reload page', async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();
      await browserManager.launch();
      mockPage.reload = jest.fn().mockResolvedValue(null);

      const result = await browserManager.reload();
      
      expect(mockPage.reload).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('newPage', () => {
    beforeEach(async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();
      await browserManager.launch();
    });

    it('should create a new page', async () => {
      const newMockPage = { ...mockPage };
      mockContext.newPage.mockResolvedValueOnce(newMockPage);

      const result = await browserManager.newPage();

      expect(mockContext.newPage).toHaveBeenCalled();
      expect(result).toBe(newMockPage);
    });

    it('should handle new page errors', async () => {
      mockContext.newPage.mockRejectedValueOnce(new Error('Cannot create page'));

      const result = await browserManager.newPage();

      expect(result).toBeNull();
    });
  });

  describe('switchToPage', () => {
    beforeEach(async () => {
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      browserManager = new BrowserManager();
      await browserManager.launch();
    });

    it('should switch to different page', async () => {
      const newPage = { 
        url: jest.fn().mockReturnValue('https://new.com'), 
        bringToFront: jest.fn(),
        title: jest.fn().mockResolvedValue('New Page')
      } as any;
      
      const result = await browserManager.switchToPage(newPage);

      expect(newPage.bringToFront).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(browserManager.getPage()).toBe(newPage);
    });
  });
});