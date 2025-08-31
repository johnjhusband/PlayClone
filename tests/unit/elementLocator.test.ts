import { ElementLocator } from '../../src/selectors/ElementLocator';
import { ElementNormalizer } from '../../src/selectors/ElementNormalizer';
import { Page, Locator } from 'playwright-core';

// Mock ElementNormalizer
jest.mock('../../src/selectors/ElementNormalizer', () => ({
  ElementNormalizer: jest.fn().mockImplementation(() => ({
    normalize: jest.fn((desc) => ({
      text: desc,
      type: 'button',
      attributes: {},
      position: null,
      action: null
    })),
    toSelectorHints: jest.fn((normalized) => ({
      text: normalized.text || '',
      type: normalized.type || 'button',
      attributes: normalized.attributes || {}
    }))
  }))
}));

describe('ElementLocator', () => {
  let elementLocator: ElementLocator;
  let mockPage: jest.Mocked<Page>;
  let mockLocator: jest.Mocked<Locator>;

  beforeEach(() => {
    elementLocator = new ElementLocator();
    
    // Setup mock locator
    mockLocator = {
      first: jest.fn().mockReturnThis(),
      last: jest.fn().mockReturnThis(),
      nth: jest.fn().mockReturnThis(),
      count: jest.fn().mockResolvedValue(1),
      click: jest.fn(),
      fill: jest.fn(),
      isVisible: jest.fn().mockResolvedValue(true),
      isEnabled: jest.fn().mockResolvedValue(true),
      boundingBox: jest.fn(),
      evaluate: jest.fn(),
      waitFor: jest.fn()
    } as any;

    // Setup mock page
    mockPage = {
      locator: jest.fn().mockReturnValue(mockLocator),
      getByRole: jest.fn().mockReturnValue(mockLocator),
      getByText: jest.fn().mockReturnValue(mockLocator),
      getByLabel: jest.fn().mockReturnValue(mockLocator),
      getByPlaceholder: jest.fn().mockReturnValue(mockLocator),
      getByAltText: jest.fn().mockReturnValue(mockLocator),
      getByTitle: jest.fn().mockReturnValue(mockLocator),
      getByTestId: jest.fn().mockReturnValue(mockLocator),
      evaluate: jest.fn(),
      $: jest.fn(),
      $$: jest.fn(),
      waitForSelector: jest.fn()
    } as any;
  });

  describe('locate', () => {
    it('should find element by exact CSS selector', async () => {
      const result = await elementLocator.locate(mockPage, '#submit-button');

      expect(mockPage.locator).toHaveBeenCalledWith('#submit-button');
      expect(result).toBe(mockLocator);
    });

    it('should find element by exact XPath', async () => {
      const result = await elementLocator.locate(mockPage, '//button[@type="submit"]');

      expect(mockPage.locator).toHaveBeenCalledWith('//button[@type="submit"]');
      expect(result).toBe(mockLocator);
    });

    it('should find element by natural language description', async () => {
      const result = await elementLocator.locate(mockPage, 'submit button');

      expect(mockPage.getByRole).toHaveBeenCalledWith('button', { name: /submit/i });
      expect(result).toBe(mockLocator);
    });

    it('should try multiple strategies for natural language', async () => {
      mockPage.getByRole.mockReturnValue({
        ...mockLocator,
        count: jest.fn().mockResolvedValue(0)
      } as any);

      await elementLocator.locate(mockPage, 'login link');

      expect(mockPage.getByRole).toHaveBeenCalled();
      expect(mockPage.getByText).toHaveBeenCalledWith(/login/i);
    });

    it('should handle "first" position modifier', async () => {
      const normalizer = new ElementNormalizer();
      (normalizer.normalize as jest.Mock).mockReturnValue({
        text: 'button',
        type: 'button',
        attributes: {},
        position: 'first',
        action: null
      });

      await elementLocator.locate(mockPage, 'first button');

      expect(mockLocator.first).toHaveBeenCalled();
    });

    it('should handle "last" position modifier', async () => {
      const normalizer = new ElementNormalizer();
      (normalizer.normalize as jest.Mock).mockReturnValue({
        text: 'button',
        type: 'button',
        attributes: {},
        position: 'last',
        action: null
      });

      await elementLocator.locate(mockPage, 'last button');

      expect(mockLocator.last).toHaveBeenCalled();
    });

    it('should handle nth position modifier', async () => {
      const normalizer = new ElementNormalizer();
      (normalizer.normalize as jest.Mock).mockReturnValue({
        text: 'button',
        type: 'button',
        attributes: {},
        position: 2,
        action: null
      });

      await elementLocator.locate(mockPage, 'second button');

      expect(mockLocator.nth).toHaveBeenCalledWith(2);
    });

    it('should throw error when no element found', async () => {
      mockLocator.count.mockResolvedValue(0);
      mockPage.getByRole.mockReturnValue(mockLocator);
      mockPage.getByText.mockReturnValue(mockLocator);
      mockPage.locator.mockReturnValue(mockLocator);

      await expect(elementLocator.locate(mockPage, 'non-existent element'))
        .rejects.toThrow('Could not find element matching: non-existent element');
    });

    it('should throw error when multiple elements found without position', async () => {
      mockLocator.count.mockResolvedValue(5);

      await expect(elementLocator.locate(mockPage, 'button'))
        .rejects.toThrow('Found 5 elements matching: button');
    });
  });

  describe('locateAll', () => {
    it('should return all matching elements', async () => {
      mockLocator.count.mockResolvedValue(3);
      mockLocator.all = jest.fn().mockResolvedValue([
        mockLocator,
        mockLocator,
        mockLocator
      ]);

      const results = await elementLocator.locateAll(mockPage, 'button');

      expect(results).toHaveLength(3);
    });

    it('should return empty array when no elements found', async () => {
      mockLocator.count.mockResolvedValue(0);
      mockLocator.all = jest.fn().mockResolvedValue([]);

      const results = await elementLocator.locateAll(mockPage, 'non-existent');

      expect(results).toHaveLength(0);
    });
  });

  describe('waitForElement', () => {
    it('should wait for element to appear', async () => {
      const result = await elementLocator.waitForElement(
        mockPage,
        'button',
        { timeout: 5000 }
      );

      expect(mockLocator.waitFor).toHaveBeenCalledWith({
        timeout: 5000,
        state: 'visible'
      });
      expect(result).toBe(mockLocator);
    });

    it('should wait for element to be hidden', async () => {
      await elementLocator.waitForElement(
        mockPage,
        'loading spinner',
        { state: 'hidden' }
      );

      expect(mockLocator.waitFor).toHaveBeenCalledWith({
        timeout: 30000,
        state: 'hidden'
      });
    });

    it('should throw timeout error', async () => {
      mockLocator.waitFor.mockRejectedValue(new Error('Timeout 5000ms exceeded'));

      await expect(elementLocator.waitForElement(
        mockPage,
        'slow element',
        { timeout: 5000 }
      )).rejects.toThrow('Timeout waiting for element: slow element');
    });
  });

  describe('isVisible', () => {
    it('should return true for visible element', async () => {
      mockLocator.isVisible.mockResolvedValue(true);

      const result = await elementLocator.isVisible(mockPage, 'button');

      expect(result).toBe(true);
    });

    it('should return false for hidden element', async () => {
      mockLocator.isVisible.mockResolvedValue(false);

      const result = await elementLocator.isVisible(mockPage, 'hidden div');

      expect(result).toBe(false);
    });

    it('should return false for non-existent element', async () => {
      mockLocator.count.mockResolvedValue(0);

      const result = await elementLocator.isVisible(mockPage, 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getElementInfo', () => {
    it('should return element information', async () => {
      mockLocator.boundingBox.mockResolvedValue({
        x: 100,
        y: 200,
        width: 300,
        height: 50
      });
      mockLocator.isVisible.mockResolvedValue(true);
      mockLocator.isEnabled.mockResolvedValue(true);
      mockLocator.evaluate.mockImplementation(() => {
        return Promise.resolve({
          tagName: 'BUTTON',
          className: 'btn btn-primary',
          id: 'submit-btn',
          textContent: 'Submit'
        });
      });

      const info = await elementLocator.getElementInfo(mockLocator);

      expect(info).toEqual({
        found: true,
        visible: true,
        enabled: true,
        box: {
          x: 100,
          y: 200,
          width: 300,
          height: 50
        },
        attributes: {
          tagName: 'BUTTON',
          className: 'btn btn-primary',
          id: 'submit-btn',
          textContent: 'Submit'
        }
      });
    });

    it('should handle non-existent element', async () => {
      mockLocator.count.mockResolvedValue(0);

      const info = await elementLocator.getElementInfo(mockLocator);

      expect(info).toEqual({
        found: false,
        visible: false,
        enabled: false,
        box: null,
        attributes: {}
      });
    });
  });

  describe('strategy selection', () => {
    it('should identify button elements', async () => {
      await elementLocator.locate(mockPage, 'submit button');
      expect(mockPage.getByRole).toHaveBeenCalledWith('button', expect.any(Object));
    });

    it('should identify link elements', async () => {
      await elementLocator.locate(mockPage, 'home link');
      expect(mockPage.getByRole).toHaveBeenCalledWith('link', expect.any(Object));
    });

    it('should identify input elements', async () => {
      await elementLocator.locate(mockPage, 'email input');
      expect(mockPage.getByLabel).toHaveBeenCalledWith(/email/i);
    });

    it('should identify image elements', async () => {
      await elementLocator.locate(mockPage, 'logo image');
      expect(mockPage.getByAltText).toHaveBeenCalledWith(/logo/i);
    });

    it('should use placeholder for field descriptions', async () => {
      await elementLocator.locate(mockPage, 'search field');
      expect(mockPage.getByPlaceholder).toHaveBeenCalledWith(/search/i);
    });
  });
});