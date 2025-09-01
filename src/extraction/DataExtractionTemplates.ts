import { Page } from 'playwright-core';

/**
 * Template field definition
 */
export interface TemplateField {
  name: string;
  selector: string;
  type: 'text' | 'number' | 'date' | 'url' | 'image' | 'price' | 'email' | 'phone' | 'array';
  required?: boolean;
  multiple?: boolean;
  transform?: (value: any) => any;
  validate?: (value: any) => boolean;
  default?: any;
  pattern?: string;
  extract?: 'text' | 'href' | 'src' | 'value' | 'data' | 'html';
}

/**
 * Data extraction template
 */
export interface ExtractionTemplate {
  name: string;
  description?: string;
  url?: string | RegExp;
  fields: TemplateField[];
  pagination?: {
    nextSelector: string;
    maxPages?: number;
  };
  beforeExtract?: (page: Page) => Promise<void>;
  afterExtract?: (data: any) => any;
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  success: boolean;
  data?: any;
  errors?: string[];
  metadata?: {
    url: string;
    timestamp: string;
    duration: number;
    template: string;
  };
}

/**
 * Built-in extraction templates
 */
export class BuiltInTemplates {
  static readonly ECOMMERCE_PRODUCT: ExtractionTemplate = {
    name: 'ecommerce_product',
    description: 'Extract product details from e-commerce pages',
    fields: [
      {
        name: 'title',
        selector: 'h1, .product-title, [data-testid="product-title"]',
        type: 'text',
        required: true
      },
      {
        name: 'price',
        selector: '.price, .product-price, [data-testid="price"], span[itemprop="price"]',
        type: 'price',
        transform: (val) => val ? parseFloat(val.replace(/[^0-9.]/g, '')) : null
      },
      {
        name: 'description',
        selector: '.product-description, .description, [itemprop="description"]',
        type: 'text'
      },
      {
        name: 'images',
        selector: '.product-image img, .gallery img, [data-testid="product-image"]',
        type: 'image',
        multiple: true,
        extract: 'src'
      },
      {
        name: 'rating',
        selector: '.rating, .stars, [data-testid="rating"]',
        type: 'number',
        transform: (val) => val ? parseFloat(val) : null
      },
      {
        name: 'availability',
        selector: '.availability, .stock, [data-testid="availability"]',
        type: 'text'
      },
      {
        name: 'sku',
        selector: '.sku, [itemprop="sku"], [data-testid="sku"]',
        type: 'text'
      }
    ]
  };

  static readonly NEWS_ARTICLE: ExtractionTemplate = {
    name: 'news_article',
    description: 'Extract news article content',
    fields: [
      {
        name: 'headline',
        selector: 'h1, .article-title, [itemprop="headline"]',
        type: 'text',
        required: true
      },
      {
        name: 'author',
        selector: '.author, .byline, [itemprop="author"]',
        type: 'text'
      },
      {
        name: 'publishDate',
        selector: 'time, .publish-date, [itemprop="datePublished"]',
        type: 'date',
        extract: 'text'
      },
      {
        name: 'content',
        selector: 'article, .article-content, .story-body, [itemprop="articleBody"]',
        type: 'text'
      },
      {
        name: 'category',
        selector: '.category, .section, [itemprop="articleSection"]',
        type: 'text'
      },
      {
        name: 'tags',
        selector: '.tag, .keyword, [rel="tag"]',
        type: 'array',
        multiple: true
      },
      {
        name: 'imageUrl',
        selector: '.article-image img, figure img, [itemprop="image"]',
        type: 'image',
        extract: 'src'
      }
    ]
  };

  static readonly SEARCH_RESULTS: ExtractionTemplate = {
    name: 'search_results',
    description: 'Extract search engine results',
    fields: [
      {
        name: 'results',
        selector: '.result, .search-result, [data-testid="result"]',
        type: 'array',
        multiple: true,
        transform: (element) => ({
          title: element.querySelector('h2, h3, .title')?.textContent,
          url: element.querySelector('a')?.href,
          description: element.querySelector('.snippet, .description')?.textContent
        })
      },
      {
        name: 'totalResults',
        selector: '.result-count, .total-results',
        type: 'number',
        transform: (val) => parseInt(val?.replace(/[^0-9]/g, '') || '0')
      },
      {
        name: 'query',
        selector: 'input[type="search"], input.search-input',
        type: 'text',
        extract: 'value'
      }
    ],
    pagination: {
      nextSelector: '.next, .pagination-next, [aria-label="Next page"]',
      maxPages: 5
    }
  };

  static readonly SOCIAL_MEDIA_POST: ExtractionTemplate = {
    name: 'social_media_post',
    description: 'Extract social media post data',
    fields: [
      {
        name: 'author',
        selector: '.username, .author, [data-testid="username"]',
        type: 'text'
      },
      {
        name: 'content',
        selector: '.post-content, .tweet-text, .message',
        type: 'text'
      },
      {
        name: 'timestamp',
        selector: 'time, .timestamp, [data-testid="timestamp"]',
        type: 'date'
      },
      {
        name: 'likes',
        selector: '.likes, .like-count, [data-testid="likes"]',
        type: 'number',
        transform: (val) => parseInt(val?.replace(/[^0-9]/g, '') || '0')
      },
      {
        name: 'shares',
        selector: '.shares, .retweet-count, [data-testid="shares"]',
        type: 'number',
        transform: (val) => parseInt(val?.replace(/[^0-9]/g, '') || '0')
      },
      {
        name: 'comments',
        selector: '.comments, .reply-count, [data-testid="comments"]',
        type: 'number',
        transform: (val) => parseInt(val?.replace(/[^0-9]/g, '') || '0')
      },
      {
        name: 'mediaUrls',
        selector: '.media img, .attachment img, video',
        type: 'array',
        multiple: true,
        extract: 'src'
      }
    ]
  };

  static readonly REAL_ESTATE_LISTING: ExtractionTemplate = {
    name: 'real_estate_listing',
    description: 'Extract real estate property details',
    fields: [
      {
        name: 'address',
        selector: '.address, .property-address, [itemprop="address"]',
        type: 'text',
        required: true
      },
      {
        name: 'price',
        selector: '.price, .listing-price, [itemprop="price"]',
        type: 'price',
        transform: (val) => val ? parseFloat(val.replace(/[^0-9.]/g, '')) : null
      },
      {
        name: 'bedrooms',
        selector: '.bedrooms, .beds, [data-testid="bedrooms"]',
        type: 'number',
        transform: (val) => parseInt(val?.replace(/[^0-9]/g, '') || '0')
      },
      {
        name: 'bathrooms',
        selector: '.bathrooms, .baths, [data-testid="bathrooms"]',
        type: 'number',
        transform: (val) => parseFloat(val?.replace(/[^0-9.]/g, '') || '0')
      },
      {
        name: 'squareFeet',
        selector: '.sqft, .square-feet, [data-testid="sqft"]',
        type: 'number',
        transform: (val) => parseInt(val?.replace(/[^0-9]/g, '') || '0')
      },
      {
        name: 'propertyType',
        selector: '.property-type, .listing-type',
        type: 'text'
      },
      {
        name: 'description',
        selector: '.description, .property-description',
        type: 'text'
      },
      {
        name: 'images',
        selector: '.gallery img, .property-images img',
        type: 'array',
        multiple: true,
        extract: 'src'
      },
      {
        name: 'agent',
        selector: '.agent-name, .realtor-name',
        type: 'text'
      }
    ]
  };

  static readonly JOB_LISTING: ExtractionTemplate = {
    name: 'job_listing',
    description: 'Extract job posting details',
    fields: [
      {
        name: 'title',
        selector: 'h1, .job-title, [itemprop="title"]',
        type: 'text',
        required: true
      },
      {
        name: 'company',
        selector: '.company, .employer, [itemprop="hiringOrganization"]',
        type: 'text'
      },
      {
        name: 'location',
        selector: '.location, .job-location, [itemprop="jobLocation"]',
        type: 'text'
      },
      {
        name: 'salary',
        selector: '.salary, .compensation, [itemprop="baseSalary"]',
        type: 'text'
      },
      {
        name: 'jobType',
        selector: '.job-type, .employment-type, [itemprop="employmentType"]',
        type: 'text'
      },
      {
        name: 'description',
        selector: '.job-description, .description, [itemprop="description"]',
        type: 'text'
      },
      {
        name: 'requirements',
        selector: '.requirements, .qualifications',
        type: 'text'
      },
      {
        name: 'benefits',
        selector: '.benefits, .perks',
        type: 'text'
      },
      {
        name: 'applyUrl',
        selector: '.apply-button, a[href*="apply"]',
        type: 'url',
        extract: 'href'
      },
      {
        name: 'postedDate',
        selector: '.posted-date, time[itemprop="datePosted"]',
        type: 'date'
      }
    ]
  };

  static readonly CONTACT_INFO: ExtractionTemplate = {
    name: 'contact_info',
    description: 'Extract contact information from pages',
    fields: [
      {
        name: 'phone',
        selector: 'a[href^="tel:"], .phone, [itemprop="telephone"]',
        type: 'phone',
        pattern: '[\d\s\-\(\)\+]+'
      },
      {
        name: 'email',
        selector: 'a[href^="mailto:"], .email, [itemprop="email"]',
        type: 'email',
        extract: 'href',
        transform: (val) => val?.replace('mailto:', '')
      },
      {
        name: 'address',
        selector: '.address, [itemprop="address"], address',
        type: 'text'
      },
      {
        name: 'socialMedia',
        selector: 'a[href*="facebook.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="instagram.com"]',
        type: 'array',
        multiple: true,
        extract: 'href'
      },
      {
        name: 'businessHours',
        selector: '.hours, .business-hours, [itemprop="openingHours"]',
        type: 'text'
      }
    ]
  };

  /**
   * Get all built-in templates
   */
  static getAll(): ExtractionTemplate[] {
    return [
      this.ECOMMERCE_PRODUCT,
      this.NEWS_ARTICLE,
      this.SEARCH_RESULTS,
      this.SOCIAL_MEDIA_POST,
      this.REAL_ESTATE_LISTING,
      this.JOB_LISTING,
      this.CONTACT_INFO
    ];
  }

  /**
   * Get template by name
   */
  static getByName(name: string): ExtractionTemplate | undefined {
    return this.getAll().find(t => t.name === name);
  }
}

/**
 * Data extraction using templates
 */
export class DataExtractionTemplates {
  private templates: Map<string, ExtractionTemplate> = new Map();

  constructor() {
    // Load built-in templates
    BuiltInTemplates.getAll().forEach(template => {
      this.templates.set(template.name, template);
    });
  }

  /**
   * Register a custom template
   */
  registerTemplate(template: ExtractionTemplate): void {
    this.templates.set(template.name, template);
  }

  /**
   * Get template by name
   */
  getTemplate(name: string): ExtractionTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * List all available templates
   */
  listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Extract data using a template
   */
  async extract(page: Page, templateName: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    const template = this.templates.get(templateName);
    
    if (!template) {
      return {
        success: false,
        errors: [`Template '${templateName}' not found`]
      };
    }

    const errors: string[] = [];
    const extractedData: any = {};

    try {
      // Execute before extract hook if defined
      if (template.beforeExtract) {
        await template.beforeExtract(page);
      }

      // Extract each field
      for (const field of template.fields) {
        try {
          const value = await this.extractField(page, field);
          
          // Validate if validator provided
          if (field.validate && value !== null && value !== undefined) {
            if (!field.validate(value)) {
              errors.push(`Validation failed for field '${field.name}'`);
              if (field.required) {
                throw new Error(`Required field '${field.name}' validation failed`);
              }
            }
          }

          // Check required fields
          if (field.required && (value === null || value === undefined || value === '')) {
            errors.push(`Required field '${field.name}' is missing`);
            throw new Error(`Required field '${field.name}' not found`);
          }

          extractedData[field.name] = value ?? field.default;
        } catch (fieldError: any) {
          errors.push(`Field '${field.name}': ${fieldError.message}`);
          if (field.required) {
            throw fieldError;
          }
        }
      }

      // Execute after extract hook if defined
      const finalData = template.afterExtract 
        ? template.afterExtract(extractedData)
        : extractedData;

      return {
        success: true,
        data: finalData,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          url: page.url(),
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          template: templateName
        }
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message, ...errors],
        metadata: {
          url: page.url(),
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          template: templateName
        }
      };
    }
  }

  /**
   * Extract a single field
   */
  private async extractField(page: Page, field: TemplateField): Promise<any> {
    try {
      // Handle multiple elements
      if (field.multiple) {
        const elements = await page.$$(field.selector);
        const values = [];
        
        for (const element of elements) {
          const value = await this.extractElementValue(element, field);
          if (value !== null && value !== undefined) {
            values.push(field.transform ? field.transform(value) : value);
          }
        }
        
        return values.length > 0 ? values : null;
      }

      // Handle single element
      const element = await page.$(field.selector);
      if (!element) {
        return null;
      }

      const value = await this.extractElementValue(element, field);
      return field.transform ? field.transform(value) : value;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract value from element based on field configuration
   */
  private async extractElementValue(element: any, field: TemplateField): Promise<any> {
    const extractType = field.extract || 'text';

    switch (extractType) {
      case 'text':
        return await element.textContent();
      case 'href':
        return await element.getAttribute('href');
      case 'src':
        return await element.getAttribute('src');
      case 'value':
        return await element.inputValue();
      case 'data':
        return await element.evaluate((el: HTMLElement) => el.dataset);
      case 'html':
        return await element.innerHTML();
      default:
        return await element.textContent();
    }
  }

  /**
   * Extract data with pagination support
   */
  async extractWithPagination(
    page: Page, 
    templateName: string, 
    maxPages?: number
  ): Promise<ExtractionResult[]> {
    const template = this.templates.get(templateName);
    if (!template || !template.pagination) {
      return [await this.extract(page, templateName)];
    }

    const results: ExtractionResult[] = [];
    const limit = maxPages || template.pagination.maxPages || 10;
    
    for (let i = 0; i < limit; i++) {
      // Extract current page
      const result = await this.extract(page, templateName);
      results.push(result);

      // Check for next page
      const nextButton = await page.$(template.pagination.nextSelector);
      if (!nextButton) {
        break;
      }

      // Navigate to next page
      try {
        await nextButton.click();
        await page.waitForLoadState('networkidle', { timeout: 5000 });
      } catch {
        break;
      }
    }

    return results;
  }

  /**
   * Auto-detect and extract data
   */
  async autoExtract(page: Page): Promise<ExtractionResult> {
    // Try to detect the page type and apply appropriate template
    const url = page.url();
    
    // Check URL patterns
    if (url.includes('product') || url.includes('item')) {
      return this.extract(page, 'ecommerce_product');
    }
    if (url.includes('article') || url.includes('news')) {
      return this.extract(page, 'news_article');
    }
    if (url.includes('search') || url.includes('results')) {
      return this.extract(page, 'search_results');
    }
    if (url.includes('property') || url.includes('listing')) {
      return this.extract(page, 'real_estate_listing');
    }
    if (url.includes('job') || url.includes('career')) {
      return this.extract(page, 'job_listing');
    }
    if (url.includes('contact') || url.includes('about')) {
      return this.extract(page, 'contact_info');
    }

    // Try each template and return the one with most data
    let bestResult: ExtractionResult | null = null;
    let maxFields = 0;

    for (const templateName of this.listTemplates()) {
      const result = await this.extract(page, templateName);
      if (result.success && result.data) {
        const fieldCount = Object.keys(result.data).filter(k => result.data[k] !== null).length;
        if (fieldCount > maxFields) {
          maxFields = fieldCount;
          bestResult = result;
        }
      }
    }

    return bestResult || {
      success: false,
      errors: ['Could not auto-detect appropriate template for this page']
    };
  }
}