import { ActionExecutor } from '../../src/actions/ActionExecutor';
import { ElementLocator } from '../../src/selectors/ElementLocator';
import { Page, Locator, Keyboard, Mouse } from 'playwright-core';

// Mock dependencies
jest.mock('../../src/selectors/ElementLocator');

describe('ActionExecutor', () => {
  let actionExecutor: ActionExecutor;
  let mockPage: jest.Mocked<Page>;
  let mockLocator: jest.Mocked<Locator>;
  let mockElementLocator: jest.Mocked<ElementLocator>;
  let mockKeyboard: jest.Mocked<Keyboard>;
  let mockMouse: jest.Mocked<Mouse>;

  beforeEach(() => {
    // Setup mock locator
    mockLocator = {
      click: jest.fn(),
      fill: jest.fn(),
      selectOption: jest.fn(),
      check: jest.fn(),
      uncheck: jest.fn(),
      hover: jest.fn(),
      focus: jest.fn(),
      press: jest.fn(),
      type: jest.fn(),
      isChecked: jest.fn(),
      isVisible: jest.fn(),
      isEnabled: jest.fn(),
      inputValue: jest.fn(),
      textContent: jest.fn(),
      evaluate: jest.fn(),
      scrollIntoViewIfNeeded: jest.fn()
    } as any;

    // Setup mock keyboard and mouse
    mockKeyboard = {
      press: jest.fn(),
      type: jest.fn(),
      down: jest.fn(),
      up: jest.fn()
    } as any;

    mockMouse = {
      move: jest.fn(),
      down: jest.fn(),
      up: jest.fn(),
      click: jest.fn()
    } as any;

    // Setup mock page
    mockPage = {
      keyboard: mockKeyboard,
      mouse: mockMouse,
      evaluate: jest.fn(),
      waitForLoadState: jest.fn(),
      screenshot: jest.fn()
    } as any;

    // Setup mock ElementLocator
    mockElementLocator = {
      locate: jest.fn().mockResolvedValue(mockLocator),
      locateAll: jest.fn(),
      locateWithWait: jest.fn().mockResolvedValue(mockLocator),
      waitForElement: jest.fn().mockResolvedValue(mockLocator),
      isVisible: jest.fn(),
      getElementInfo: jest.fn()
    } as any;

    // Create ActionExecutor with mocked dependencies
    (ElementLocator as jest.Mock).mockImplementation(() => mockElementLocator);
    
    actionExecutor = new ActionExecutor(mockElementLocator);
  });

  describe('click', () => {
    it('should click on element', async () => {
      const result = await actionExecutor.click(mockPage, 'submit button');

      expect(mockElementLocator.locateWithWait).toHaveBeenCalledWith(
        mockPage,
        'submit button',
        expect.objectContaining({ timeout: 5000 })
      );
      expect(mockLocator.scrollIntoViewIfNeeded).toHaveBeenCalled();
      expect(mockLocator.click).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle click with options', async () => {
      await actionExecutor.click(mockPage, 'button');

      expect(mockLocator.click).toHaveBeenCalled();
    });

    it('should handle click errors', async () => {
      mockLocator.click.mockRejectedValue(new Error('Element not clickable'));

      const result = await actionExecutor.click(mockPage, 'disabled button');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to click');
    });

    it('should wait for navigation if specified', async () => {
      await actionExecutor.click(mockPage, 'navigate link');

      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle');
    });
  });

  describe('fill', () => {
    it('should fill input field', async () => {
      const result = await actionExecutor.fill(
        mockPage,
        'email field',
        'test@example.com'
      );

      expect(mockLocator.fill).toHaveBeenCalledWith('test@example.com');
      expect(result.success).toBe(true);
    });

    it('should clear field before filling if specified', async () => {
      await actionExecutor.fill(
        mockPage,
        'username',
        'newuser'
      );

      expect(mockLocator.fill).toHaveBeenCalledWith('');
      expect(mockLocator.fill).toHaveBeenCalledWith('newuser');
    });

    it('should handle fill errors', async () => {
      mockLocator.fill.mockRejectedValue(new Error('Cannot fill element'));

      const result = await actionExecutor.fill(mockPage, 'readonly field', 'text');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fill');
    });
  });

  describe('select', () => {
    it('should select option by value', async () => {
      mockLocator.selectOption.mockResolvedValue(['option1']);

      const result = await actionExecutor.select(
        mockPage,
        'country dropdown',
        'USA'
      );

      expect(mockLocator.selectOption).toHaveBeenCalledWith('USA');
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ value: ['USA'] });
    });

    it('should select multiple options', async () => {
      mockLocator.selectOption.mockResolvedValue(['opt1', 'opt2']);

      const result = await actionExecutor.select(
        mockPage,
        'multi-select',
        ['option1', 'option2']
      );

      expect(mockLocator.selectOption).toHaveBeenCalledWith(['option1', 'option2']);
      expect(result.value).toEqual({ value: ['option1', 'option2'] });
    });

    it('should handle select errors', async () => {
      mockLocator.selectOption.mockRejectedValue(new Error('Invalid option'));

      const result = await actionExecutor.select(mockPage, 'dropdown', 'invalid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to select');
    });
  });

  describe('check/uncheck', () => {
    it('should check checkbox', async () => {
      mockLocator.isChecked.mockResolvedValue(false);

      const result = await actionExecutor.check(mockPage, 'terms checkbox');

      expect(mockLocator.check).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should not check if already checked', async () => {
      mockLocator.isChecked.mockResolvedValue(true);

      const result = await actionExecutor.check(mockPage, 'checked box');

      expect(mockLocator.check).not.toHaveBeenCalled();
      expect(result.value).toBe(true);
    });

    it('should uncheck checkbox', async () => {
      mockLocator.isChecked.mockResolvedValue(true);

      const result = await actionExecutor.check(mockPage, 'newsletter checkbox', false);

      expect(mockLocator.uncheck).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should not uncheck if already unchecked', async () => {
      mockLocator.isChecked.mockResolvedValue(false);

      const result = await actionExecutor.check(mockPage, 'unchecked box', false);

      expect(mockLocator.uncheck).not.toHaveBeenCalled();
      expect(result.value).toBe(false);
    });
  });

  describe('hover', () => {
    it('should hover over element', async () => {
      const result = await actionExecutor.hover(mockPage, 'menu item');

      expect(mockLocator.hover).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle hover with modifiers', async () => {
      await actionExecutor.hover(mockPage, 'link');

      expect(mockLocator.hover).toHaveBeenCalled();
    });

    it('should handle hover errors', async () => {
      mockLocator.hover.mockRejectedValue(new Error('Cannot hover'));

      const result = await actionExecutor.hover(mockPage, 'hidden element');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to hover');
    });
  });

  describe('focus', () => {
    it('should focus on element', async () => {
      const result = await actionExecutor.focus(mockPage, 'search input');

      expect(mockLocator.focus).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle focus errors', async () => {
      mockLocator.focus.mockRejectedValue(new Error('Cannot focus'));

      const result = await actionExecutor.focus(mockPage, 'disabled input');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to focus');
    });
  });

  describe('type', () => {
    it('should type text with delay', async () => {
      mockPage.keyboard = { 
        type: jest.fn().mockResolvedValue(undefined),
        down: jest.fn(),
        insertText: jest.fn(),
        press: jest.fn(),
        up: jest.fn()
      } as any;
      
      const result = await actionExecutor.type(
        mockPage,
        'test query',
        100
      );

      expect(mockPage.keyboard.type).toHaveBeenCalledWith('test query', { delay: 100 });
      expect(result.success).toBe(true);
    });

    it('should handle type errors', async () => {
      mockPage.keyboard = { 
        type: jest.fn().mockRejectedValue(new Error('Cannot type')),
        down: jest.fn(),
        insertText: jest.fn(),
        press: jest.fn(),
        up: jest.fn()
      } as any;

      const result = await actionExecutor.type(mockPage, 'text');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot type');
    });
  });

  describe('press', () => {
    it('should press key on element', async () => {
      mockPage.keyboard = { 
        press: jest.fn().mockResolvedValue(undefined),
        type: jest.fn(),
        down: jest.fn(),
        insertText: jest.fn(),
        up: jest.fn()
      } as any;
      const result = await actionExecutor.press(mockPage, 'Enter');

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
      expect(result.success).toBe(true);
    });

    it('should press key globally when no selector', async () => {
      mockPage.keyboard = { 
        press: jest.fn().mockResolvedValue(undefined),
        type: jest.fn(),
        down: jest.fn(),
        insertText: jest.fn(),
        up: jest.fn()
      } as any;
      const result = await actionExecutor.press(mockPage, 'Escape');

      expect(mockKeyboard.press).toHaveBeenCalledWith('Escape');
      expect(result.success).toBe(true);
    });

    it('should handle key combinations', async () => {
      mockPage.keyboard = { 
        press: jest.fn().mockResolvedValue(undefined),
        type: jest.fn(),
        down: jest.fn(),
        insertText: jest.fn(),
        up: jest.fn()
      } as any;
      await actionExecutor.press(mockPage, 'Control+A');

      expect(mockKeyboard.press).toHaveBeenCalledWith('Control+A');
    });

    it('should handle press errors', async () => {
      mockLocator.press.mockRejectedValue(new Error('Invalid key'));

      mockPage.keyboard = { 
        press: jest.fn().mockRejectedValue(new Error('Unknown key')),
        type: jest.fn(),
        down: jest.fn(),
        insertText: jest.fn(),
        up: jest.fn()
      } as any;
      const result = await actionExecutor.press(mockPage, 'InvalidKey');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to press key');
    });
  });

  describe('getValue', () => {
    it('should get input value', async () => {
      mockLocator.inputValue.mockResolvedValue('current value');

      const result = await actionExecutor.getValue(mockPage, 'text input');

      expect(result.success).toBe(true);
      expect(result.value).toBe('current value');
    });

    it('should get checkbox state', async () => {
      mockLocator.evaluate.mockImplementation((_fn: any) => {
        return Promise.resolve('checkbox');
      });
      mockLocator.isChecked.mockResolvedValue(true);

      const result = await actionExecutor.getValue(mockPage, 'checkbox');

      expect(result.value).toBe(true);
    });

    it('should get select value', async () => {
      mockLocator.evaluate.mockImplementation((fn: any) => {
        if (fn.toString().includes('tagName')) {
          return Promise.resolve('SELECT');
        }
        return Promise.resolve('selected-option');
      });

      const result = await actionExecutor.getValue(mockPage, 'dropdown');

      expect(result.value).toBe('selected-option');
    });

    it('should handle getValue errors', async () => {
      mockElementLocator.locate.mockRejectedValue(new Error('Element not found'));

      const result = await actionExecutor.getValue(mockPage, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get value');
    });
  });

  describe('scroll', () => {
    it('should scroll in specified direction', async () => {
      const result = await actionExecutor.scroll(mockPage, 'down', 200);

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle scroll up', async () => {
      const result = await actionExecutor.scroll(mockPage, 'up', 100);

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle scroll errors', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Cannot scroll'));

      const result = await actionExecutor.scroll(mockPage, 'down');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to scroll');
    });
  });
});