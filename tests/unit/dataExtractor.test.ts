import { DataExtractor } from '../../src/extractors/DataExtractor';
import { ElementLocator } from '../../src/selectors/ElementLocator';
import { Page } from 'playwright-core';

// Mock ElementLocator
jest.mock('../../src/selectors/ElementLocator');

describe('DataExtractor', () => {
  let dataExtractor: DataExtractor;
  let mockPage: jest.Mocked<Page>;
  let mockLocator: any; // Use any for mock with custom properties
  let mockElementLocator: jest.Mocked<ElementLocator>;

  beforeEach(() => {
    // Setup mock locator
    mockLocator = {
      textContent: jest.fn(),
      innerHTML: jest.fn(),
      getAttribute: jest.fn(),
      evaluate: jest.fn(),
      all: jest.fn(),
      count: jest.fn(),
      $$eval: jest.fn(),
      screenshot: jest.fn()
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
      expect(result.value).toBe('Sample text content');
    });

    it('should extract text from entire page when no selector', async () => {
      mockPage.evaluate.mockResolvedValue('Full page text');

      const result = await dataExtractor.getText(mockPage);

      expect(result.success).toBe(true);
      expect(result.value).toBe('Full page text');
    });

    it('should extract text with HTML selector', async () => {
      mockLocator.textContent.mockResolvedValue('HTML content');

      const result = await dataExtractor.getText(mockPage, 'div');

      expect(result.value).toBe('HTML content');
    });

    it('should handle text extraction errors', async () => {
      mockLocator.textContent.mockRejectedValue(new Error('Cannot get text'));

      const result = await dataExtractor.getText(mockPage, 'element');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot get text');
    });
  });

  describe('getTable', () => {
    it('should extract table data', async () => {
      mockLocator.evaluate.mockResolvedValue({
        headers: ['Name', 'Age', 'City'],
        data: [
          { Name: 'John', Age: '30', City: 'New York' },
          { Name: 'Jane', Age: '25', City: 'Los Angeles' }
        ]
      });
      mockElementLocator.locate.mockResolvedValue(mockLocator);

      const result = await dataExtractor.getTable(mockPage, 'data table');

      expect(result.success).toBe(true);
      expect(result.value.tables).toBeDefined();
      expect(result.value.tables[0].headers).toEqual(['Name', 'Age', 'City']);
      expect(result.value.tables[0].data).toEqual([
        { Name: 'John', Age: '30', City: 'New York' },
        { Name: 'Jane', Age: '25', City: 'Los Angeles' }
      ]);
      expect(result.value).toHaveProperty('duration');
    });

    it('should extract table as objects if requested', async () => {
      mockLocator.evaluate.mockResolvedValue({
        headers: ['name', 'age'],
        data: [
          { name: 'John', age: '30' },
          { name: 'Jane', age: '25' }
        ]
      });
      mockElementLocator.locate.mockResolvedValue(mockLocator);

      const result = await dataExtractor.getTable(mockPage, 'table');

      expect(result.value.tables).toBeDefined();
      expect(result.value.tables[0].data).toEqual([
        { name: 'John', age: '30' },
        { name: 'Jane', age: '25' }
      ]);
      expect(result.value).toHaveProperty('duration');
    });

    it('should handle table extraction errors', async () => {
      mockElementLocator.locate.mockRejectedValue(new Error('Table not found'));

      const result = await dataExtractor.getTable(mockPage, 'missing table');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Table extraction failed');
    });
  });

  describe('getFormData', () => {
    it('should extract form field values', async () => {
      mockLocator.evaluate.mockResolvedValue({
        username: 'john_doe',
        email: 'john@example.com',
        subscribe: true
      });
      mockElementLocator.locate.mockResolvedValue(mockLocator);

      const result = await dataExtractor.getFormData(mockPage, 'login form');

      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        fields: {
          username: 'john_doe',
          email: 'john@example.com',
          subscribe: true
        },
        duration: expect.any(Number)
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

      expect(result.value.forms).toEqual([
        {
          name: 'loginForm',
          fields: { username: 'user1' }
        },
        {
          name: 'signupForm',
          fields: { email: 'test@example.com' }
        }
      ]);
      expect(result.value).toHaveProperty('duration');
    });

    it('should handle form extraction errors', async () => {
      mockElementLocator.locate.mockRejectedValue(new Error('Form not found'));

      const result = await dataExtractor.getFormData(mockPage, 'missing form');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Form not found');
    });
  });

  describe('getLinks', () => {
    it('should extract all links from page', async () => {
      mockPage.evaluate.mockResolvedValue([
        { text: 'Home', href: '/', title: 'Go home', target: '', rel: '' },
        { text: 'About', href: '/about', title: 'About us', target: '', rel: '' },
        { text: 'Contact', href: '/contact', title: null, target: '', rel: '' }
      ]);

      const result = await dataExtractor.getLinks(mockPage);

      expect(result.success).toBe(true);
      expect(result.value.links).toEqual([
        { text: 'Home', href: '/', title: 'Go home', target: '', rel: '' },
        { text: 'About', href: '/about', title: 'About us', target: '', rel: '' },
        { text: 'Contact', href: '/contact', title: null, target: '', rel: '' }
      ]);
      expect(result.value.count).toBe(3);
      expect(result.value).toHaveProperty('duration');
    });

    it('should filter links by pattern', async () => {
      mockPage.evaluate.mockResolvedValue([
        { text: 'External', href: 'https://external.com', target: '', rel: '', title: '' },
        { text: 'Internal', href: '/page', target: '', rel: '', title: '' }
      ]);

      const result = await dataExtractor.getLinks(mockPage);

      expect(result.value.links).toHaveLength(2);
      expect(result.value.count).toBe(2);
      expect(result.value).toHaveProperty('duration');
    });

    it('should extract links from specific container', async () => {
      mockPage.evaluate.mockResolvedValue([
        { text: 'Nav Link 1', href: '/nav1', target: '', rel: '', title: '' },
        { text: 'Nav Link 2', href: '/nav2', target: '', rel: '', title: '' }
      ]);

      const result = await dataExtractor.getLinks(mockPage);

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(result.value.count).toBe(2);
    });

    it('should handle link extraction errors', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Invalid URL'));

      const result = await dataExtractor.getLinks(mockPage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot get links');
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
      expect(result.value.attributes).toEqual({
        id: 'submit-btn',
        class: 'btn btn-primary',
        type: 'submit',
        disabled: false,
        'data-action': 'submit-form'
      });
      expect(result.value).toHaveProperty('duration');
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

      expect(result.value.attributes).toEqual({
        id: 'element-id',
        class: 'element-class'
      });
      expect(result.value).toHaveProperty('duration');
    });

    it('should handle attribute extraction errors', async () => {
      mockElementLocator.locate.mockRejectedValue(new Error('Element not found'));

      const result = await dataExtractor.getAttributes(mockPage, 'missing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
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
      expect(result.value.title).toBe('Page Title');
      expect(result.value.url).toBe('https://example.com/page');
      expect(result.value.description).toBe('Page description');
      expect(result.value.keywords).toBe('keyword1, keyword2');
      expect(result.value.openGraph).toEqual({
        'og:title': 'OG Title',
        'og:description': 'OG Description'
      });
      expect(result.value).toHaveProperty('duration');
    });

    it('should handle page info extraction errors gracefully', async () => {
      mockPage.title.mockRejectedValue(new Error('Cannot get title'));
      mockPage.url.mockReturnValue('https://example.com');

      const result = await dataExtractor.getPageInfo(mockPage);

      expect(result.success).toBe(true);
      expect(result.value.url).toBe('https://example.com');
      expect(result.value.title).toBeUndefined();
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
      expect(result.value.format).toBe('base64');
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
      expect(result.value.path).toBe('/tmp/screenshot.png');
    });

    it('should handle screenshot errors', async () => {
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot failed'));

      const result = await dataExtractor.screenshot(mockPage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Screenshot failed');
    });
  });

  describe('extractStructuredData', () => {
    it('should extract JSON-LD structured data', async () => {
      mockPage.evaluate.mockResolvedValue({
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            'name': 'Product Name',
            'price': '99.99'
          }
        ],
        microdata: []
      });

      const result = await dataExtractor.extractStructuredData(mockPage);

      expect(result.success).toBe(true);
      expect(result.value.jsonLd).toEqual([
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          'name': 'Product Name',
          'price': '99.99'
        }
      ]);
      expect(result.value).toHaveProperty('duration');
    });

    it('should handle structured data extraction errors', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Cannot extract data'));

      const result = await dataExtractor.extractStructuredData(mockPage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Structured data extraction failed');
    });
  });
});