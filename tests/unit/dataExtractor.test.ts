import { DataExtractor } from '../../src/extractors/DataExtractor';
import { ElementLocator } from '../../src/selectors/ElementLocator';
import { Page, Locator } from 'playwright-core';

// Mock ElementLocator
jest.mock('../../src/selectors/ElementLocator');

describe('DataExtractor', () => {
  let dataExtractor: DataExtractor;
  let mockPage: jest.Mocked<Page>;
  let mockLocator: jest.Mocked<Locator>;
  let mockElementLocator: jest.Mocked<ElementLocator>;

  beforeEach(() => {
    // Setup mock locator
    mockLocator = {
      textContent: jest.fn(),
      innerHTML: jest.fn(),
      getAttribute: jest.fn(),
      evaluate: jest.fn(),
      all: jest.fn(),
      count: jest.fn()
    } as any;

    // Setup mock page
    mockPage = {
      title: jest.fn(),
      url: jest.fn(),
      content: jest.fn(),
      evaluate: jest.fn(),
      screenshot: jest.fn(),
      pdf: jest.fn(),
      locator: jest.fn().mockReturnValue(mockLocator),
      $$eval: jest.fn(),
      $eval: jest.fn()
    } as any;

    // Setup mock ElementLocator
    mockElementLocator = {
      locate: jest.fn().mockResolvedValue(mockLocator),
      locateAll: jest.fn()
    } as any;

    // Create DataExtractor with mocked dependencies
    (ElementLocator as jest.Mock).mockImplementation(() => mockElementLocator);
    dataExtractor = new DataExtractor();
  });

  describe('getText', () => {
    it('should extract text from element', async () => {
      mockLocator.textContent.mockResolvedValue('Sample text content');

      const result = await dataExtractor.getText(mockPage, 'paragraph');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ text: 'Sample text content' });
    });

    it('should extract text from entire page when no selector', async () => {
      mockPage.evaluate.mockResolvedValue('Full page text');

      const result = await dataExtractor.getText(mockPage);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ text: 'Full page text' });
    });

    it('should include HTML if requested', async () => {
      mockLocator.innerHTML.mockResolvedValue('<p>HTML content</p>');

      const result = await dataExtractor.getText(mockPage, 'div', {
        includeHtml: true
      });

      expect(result.data).toEqual({
        text: null,
        html: '<p>HTML content</p>'
      });
    });

    it('should handle text extraction errors', async () => {
      mockLocator.textContent.mockRejectedValue(new Error('Cannot get text'));

      const result = await dataExtractor.getText(mockPage, 'element');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract text');
    });
  });

  describe('getTable', () => {
    it('should extract table data', async () => {
      const mockTable = {
        evaluate: jest.fn().mockResolvedValue({
          headers: ['Name', 'Age', 'City'],
          rows: [
            ['John', '30', 'New York'],
            ['Jane', '25', 'Los Angeles']
          ]
        })
      };
      mockElementLocator.locate.mockResolvedValue(mockTable);

      const result = await dataExtractor.getTable(mockPage, 'data table');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        headers: ['Name', 'Age', 'City'],
        rows: [
          ['John', '30', 'New York'],
          ['Jane', '25', 'Los Angeles']
        ]
      });
    });

    it('should extract table as objects if requested', async () => {
      const mockTable = {
        evaluate: jest.fn().mockResolvedValue({
          headers: ['name', 'age'],
          rows: [
            ['John', '30'],
            ['Jane', '25']
          ]
        })
      };
      mockElementLocator.locate.mockResolvedValue(mockTable);

      const result = await dataExtractor.getTable(mockPage, 'table', {
        asObjects: true
      });

      expect(result.data).toEqual({
        rows: [
          { name: 'John', age: '30' },
          { name: 'Jane', age: '25' }
        ]
      });
    });

    it('should handle table extraction errors', async () => {
      mockElementLocator.locate.mockRejectedValue(new Error('Table not found'));

      const result = await dataExtractor.getTable(mockPage, 'missing table');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract table');
    });
  });

  describe('getFormData', () => {
    it('should extract form field values', async () => {
      const mockForm = {
        $$eval: jest.fn().mockResolvedValue([
          { name: 'username', value: 'john_doe', type: 'text' },
          { name: 'email', value: 'john@example.com', type: 'email' },
          { name: 'subscribe', checked: true, type: 'checkbox' }
        ])
      };
      mockElementLocator.locate.mockResolvedValue(mockForm);

      const result = await dataExtractor.getFormData(mockPage, 'login form');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        fields: {
          username: 'john_doe',
          email: 'john@example.com',
          subscribe: true
        }
      });
    });

    it('should extract all forms when no selector', async () => {
      mockPage.$$eval.mockResolvedValue([
        {
          name: 'loginForm',
          fields: { username: 'user1' }
        },
        {
          name: 'signupForm',
          fields: { email: 'test@example.com' }
        }
      ]);

      const result = await dataExtractor.getFormData(mockPage);

      expect(result.data).toEqual({
        forms: [
          {
            name: 'loginForm',
            fields: { username: 'user1' }
          },
          {
            name: 'signupForm',
            fields: { email: 'test@example.com' }
          }
        ]
      });
    });

    it('should handle form extraction errors', async () => {
      mockElementLocator.locate.mockRejectedValue(new Error('Form not found'));

      const result = await dataExtractor.getFormData(mockPage, 'missing form');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract form data');
    });
  });

  describe('getLinks', () => {
    it('should extract all links from page', async () => {
      mockPage.$$eval.mockResolvedValue([
        { text: 'Home', href: '/', title: 'Go home' },
        { text: 'About', href: '/about', title: 'About us' },
        { text: 'Contact', href: '/contact', title: null }
      ]);

      const result = await dataExtractor.getLinks(mockPage);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        links: [
          { text: 'Home', href: '/', title: 'Go home' },
          { text: 'About', href: '/about', title: 'About us' },
          { text: 'Contact', href: '/contact', title: null }
        ],
        count: 3
      });
    });

    it('should filter links by pattern', async () => {
      mockPage.$$eval.mockResolvedValue([
        { text: 'External', href: 'https://external.com' },
        { text: 'Internal', href: '/page' }
      ]);

      const result = await dataExtractor.getLinks(mockPage, {
        pattern: /^https:/
      });

      expect(result.data).toEqual({
        links: [
          { text: 'External', href: 'https://external.com' }
        ],
        count: 1
      });
    });

    it('should extract links from specific container', async () => {
      const mockContainer = {
        $$eval: jest.fn().mockResolvedValue([
          { text: 'Nav Link 1', href: '/nav1' },
          { text: 'Nav Link 2', href: '/nav2' }
        ])
      };
      mockElementLocator.locate.mockResolvedValue(mockContainer);

      const result = await dataExtractor.getLinks(mockPage, {
        container: 'nav'
      });

      expect(mockContainer.$$eval).toHaveBeenCalled();
      expect(result.data.count).toBe(2);
    });

    it('should handle link extraction errors', async () => {
      mockPage.$$eval.mockRejectedValue(new Error('Cannot get links'));

      const result = await dataExtractor.getLinks(mockPage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract links');
    });
  });

  describe('getAttributes', () => {
    it('should extract element attributes', async () => {
      mockLocator.evaluate.mockResolvedValue({
        id: 'submit-btn',
        class: 'btn btn-primary',
        type: 'submit',
        disabled: false,
        'data-action': 'submit-form'
      });

      const result = await dataExtractor.getAttributes(mockPage, 'submit button');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        attributes: {
          id: 'submit-btn',
          class: 'btn btn-primary',
          type: 'submit',
          disabled: false,
          'data-action': 'submit-form'
        }
      });
    });

    it('should extract specific attributes only', async () => {
      mockLocator.evaluate.mockResolvedValue({
        id: 'element-id',
        class: 'element-class'
      });

      const result = await dataExtractor.getAttributes(
        mockPage,
        'element',
        ['id', 'class']
      );

      expect(result.data).toEqual({
        attributes: {
          id: 'element-id',
          class: 'element-class'
        }
      });
    });

    it('should handle attribute extraction errors', async () => {
      mockElementLocator.locate.mockRejectedValue(new Error('Element not found'));

      const result = await dataExtractor.getAttributes(mockPage, 'missing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract attributes');
    });
  });

  describe('getPageInfo', () => {
    it('should extract page metadata', async () => {
      mockPage.title.mockResolvedValue('Page Title');
      mockPage.url.mockReturnValue('https://example.com/page');
      mockPage.evaluate.mockImplementation((fn: any) => {
        const fnStr = fn.toString();
        if (fnStr.includes('description')) {
          return Promise.resolve('Page description');
        } else if (fnStr.includes('keywords')) {
          return Promise.resolve('keyword1, keyword2');
        } else if (fnStr.includes('og:')) {
          return Promise.resolve({
            'og:title': 'OG Title',
            'og:description': 'OG Description'
          });
        }
        return Promise.resolve(null);
      });

      const result = await dataExtractor.getPageInfo(mockPage);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        title: 'Page Title',
        url: 'https://example.com/page',
        description: 'Page description',
        keywords: 'keyword1, keyword2',
        openGraph: {
          'og:title': 'OG Title',
          'og:description': 'OG Description'
        }
      });
    });

    it('should handle page info extraction errors gracefully', async () => {
      mockPage.title.mockRejectedValue(new Error('Cannot get title'));
      mockPage.url.mockReturnValue('https://example.com');

      const result = await dataExtractor.getPageInfo(mockPage);

      expect(result.success).toBe(true);
      expect(result.data.url).toBe('https://example.com');
      expect(result.data.title).toBeUndefined();
    });
  });

  describe('screenshot', () => {
    it('should take full page screenshot', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from('image data'));

      const result = await dataExtractor.screenshot(mockPage);

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        fullPage: false,
        type: 'png'
      });
      expect(result.success).toBe(true);
      expect(result.data.format).toBe('base64');
    });

    it('should take element screenshot', async () => {
      mockLocator.screenshot = jest.fn().mockResolvedValue(Buffer.from('element image'));

      const result = await dataExtractor.screenshot(mockPage, {
        selector: 'header'
      });

      expect(mockLocator.screenshot).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should save screenshot to path', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from('image data'));

      const result = await dataExtractor.screenshot(mockPage, {
        path: '/tmp/screenshot.png'
      });

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/tmp/screenshot.png'
        })
      );
      expect(result.data.path).toBe('/tmp/screenshot.png');
    });

    it('should handle screenshot errors', async () => {
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot failed'));

      const result = await dataExtractor.screenshot(mockPage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to take screenshot');
    });
  });

  describe('extractStructuredData', () => {
    it('should extract JSON-LD structured data', async () => {
      mockPage.$$eval.mockResolvedValue([
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          'name': 'Product Name',
          'price': '99.99'
        }
      ]);

      const result = await dataExtractor.extractStructuredData(mockPage);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            'name': 'Product Name',
            'price': '99.99'
          }
        ]
      });
    });

    it('should handle structured data extraction errors', async () => {
      mockPage.$$eval.mockRejectedValue(new Error('Cannot extract data'));

      const result = await dataExtractor.extractStructuredData(mockPage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract structured data');
    });
  });
});