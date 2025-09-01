import { Page } from 'playwright-core';

/**
 * Data validation rule definition
 */
export interface ValidationRule {
  type: 'required' | 'email' | 'url' | 'phone' | 'date' | 'number' | 'regex' | 'length' | 'custom';
  message?: string;
  options?: any;
}

/**
 * Field validation configuration
 */
export interface FieldValidation {
  field: string;
  rules: ValidationRule[];
  sanitize?: boolean;
  transform?: (value: any) => any;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: { field: string; rule: string; message: string }[];
  warnings: { field: string; message: string }[];
  sanitized?: any;
}

/**
 * Data sanitization options
 */
export interface SanitizationOptions {
  removeHtml?: boolean;
  trimWhitespace?: boolean;
  normalizeWhitespace?: boolean;
  removeSpecialChars?: boolean;
  allowedTags?: string[];
  maxLength?: number;
  encoding?: 'escape' | 'remove' | 'encode';
}

/**
 * DataValidator - Validates and sanitizes extracted data
 */
export class DataValidator {
  private page: Page;
  private validationRules: Map<string, FieldValidation[]> = new Map();
  private customValidators: Map<string, (value: any) => boolean> = new Map();

  constructor(page: Page) {
    this.page = page;
    this.registerBuiltInValidators();
  }

  /**
   * Register built-in validators
   */
  private registerBuiltInValidators(): void {
    // Email validator
    this.customValidators.set('email', (value: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    });

    // URL validator
    this.customValidators.set('url', (value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    });

    // Phone validator (basic international format)
    this.customValidators.set('phone', (value: string) => {
      const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,5}$/;
      return phoneRegex.test(value.replace(/\s/g, ''));
    });

    // Date validator (ISO format)
    this.customValidators.set('date', (value: string) => {
      const date = new Date(value);
      return !isNaN(date.getTime());
    });

    // Number validator
    this.customValidators.set('number', (value: any) => {
      return !isNaN(Number(value));
    });
  }

  /**
   * Register custom validator
   */
  registerValidator(name: string, validator: (value: any) => boolean): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Add validation rules for a dataset
   */
  addValidationRules(datasetName: string, rules: FieldValidation[]): void {
    this.validationRules.set(datasetName, rules);
  }

  /**
   * Validate data against rules
   */
  validate(data: any, rulesOrDataset: FieldValidation[] | string): ValidationResult {
    const rules = typeof rulesOrDataset === 'string' 
      ? this.validationRules.get(rulesOrDataset) || []
      : rulesOrDataset;

    const errors: { field: string; rule: string; message: string }[] = [];
    const warnings: { field: string; message: string }[] = [];
    let sanitized = { ...data };

    for (const fieldRule of rules) {
      const value = this.getNestedValue(data, fieldRule.field);
      
      // Apply transformation if specified
      if (fieldRule.transform) {
        sanitized = this.setNestedValue(sanitized, fieldRule.field, fieldRule.transform(value));
      }

      // Apply sanitization if specified
      if (fieldRule.sanitize) {
        const sanitizedValue = this.sanitizeValue(value);
        sanitized = this.setNestedValue(sanitized, fieldRule.field, sanitizedValue);
      }

      // Validate against rules
      for (const rule of fieldRule.rules) {
        const isValid = this.validateRule(value, rule);
        if (!isValid) {
          errors.push({
            field: fieldRule.field,
            rule: rule.type,
            message: rule.message || `Validation failed for ${fieldRule.field}: ${rule.type}`
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized
    };
  }

  /**
   * Validate a single value against a rule
   */
  private validateRule(value: any, rule: ValidationRule): boolean {
    switch (rule.type) {
      case 'required':
        return value !== null && value !== undefined && value !== '';
      
      case 'email':
      case 'url':
      case 'phone':
      case 'date':
      case 'number':
        const validator = this.customValidators.get(rule.type);
        return validator ? validator(value) : false;
      
      case 'regex':
        if (!rule.options?.pattern) return false;
        const regex = new RegExp(rule.options.pattern, rule.options.flags);
        return regex.test(String(value));
      
      case 'length':
        const length = String(value).length;
        const min = rule.options?.min || 0;
        const max = rule.options?.max || Infinity;
        return length >= min && length <= max;
      
      case 'custom':
        if (!rule.options?.validator) return false;
        const customValidator = this.customValidators.get(rule.options.validator);
        return customValidator ? customValidator(value) : false;
      
      default:
        return true;
    }
  }

  /**
   * Sanitize a value
   */
  sanitizeValue(value: any, options: SanitizationOptions = {}): any {
    if (typeof value !== 'string') return value;

    let sanitized = value;

    // Remove HTML tags
    if (options.removeHtml !== false) {
      if (options.allowedTags && options.allowedTags.length > 0) {
        // Keep allowed tags
        const allowedPattern = options.allowedTags.join('|');
        const regex = new RegExp(`<(?!\/?(?:${allowedPattern})\s*\/?>)[^>]+>`, 'gi');
        sanitized = sanitized.replace(regex, '');
      } else {
        // Remove all HTML
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      }
    }

    // Trim whitespace
    if (options.trimWhitespace !== false) {
      sanitized = sanitized.trim();
    }

    // Normalize whitespace
    if (options.normalizeWhitespace) {
      sanitized = sanitized.replace(/\s+/g, ' ');
    }

    // Remove special characters
    if (options.removeSpecialChars) {
      sanitized = sanitized.replace(/[^a-zA-Z0-9\s]/g, '');
    }

    // Handle encoding
    if (options.encoding === 'escape') {
      sanitized = this.escapeHtml(sanitized);
    } else if (options.encoding === 'encode') {
      sanitized = encodeURIComponent(sanitized);
    }

    // Apply max length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Sanitize an entire dataset
   */
  sanitizeDataset(data: any, options: SanitizationOptions = {}): any {
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeDataset(item, options));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeDataset(value, options);
      }
      return sanitized;
    }

    if (typeof data === 'string') {
      return this.sanitizeValue(data, options);
    }

    return data;
  }

  /**
   * Validate extracted form data
   */
  async validateForm(selector?: string): Promise<ValidationResult> {
    const formData = await this.extractFormData(selector);
    const rules: FieldValidation[] = [];

    // Auto-detect validation rules based on input types
    for (const [name, value] of Object.entries(formData)) {
      const inputType = await this.getInputType(name);
      const fieldRules: ValidationRule[] = [];

      // Add rules based on input type
      if (inputType === 'email') {
        fieldRules.push({ type: 'email' });
      } else if (inputType === 'url') {
        fieldRules.push({ type: 'url' });
      } else if (inputType === 'tel') {
        fieldRules.push({ type: 'phone' });
      } else if (inputType === 'number') {
        fieldRules.push({ type: 'number' });
      }

      // Check for required attribute
      const isRequired = await this.isFieldRequired(name);
      if (isRequired) {
        fieldRules.push({ type: 'required' });
      }

      if (fieldRules.length > 0) {
        rules.push({
          field: name,
          rules: fieldRules,
          sanitize: true
        });
      }
    }

    return this.validate(formData, rules);
  }

  /**
   * Validate URLs in extracted data
   */
  validateUrls(data: any): { valid: string[]; invalid: string[] } {
    const urls = this.extractUrls(data);
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const url of urls) {
      try {
        new URL(url);
        valid.push(url);
      } catch {
        invalid.push(url);
      }
    }

    return { valid, invalid };
  }

  /**
   * Validate and clean email addresses
   */
  validateEmails(data: any): { valid: string[]; invalid: string[] } {
    const emails = this.extractEmails(data);
    const valid: string[] = [];
    const invalid: string[] = [];
    const emailValidator = this.customValidators.get('email')!;

    for (const email of emails) {
      if (emailValidator(email)) {
        valid.push(email.toLowerCase());
      } else {
        invalid.push(email);
      }
    }

    return { valid, invalid };
  }

  /**
   * Remove duplicate entries from dataset
   */
  removeDuplicates<T>(data: T[], keyField?: keyof T): T[] {
    if (!keyField) {
      // Remove duplicates based on full object comparison
      return Array.from(new Set(data.map(item => JSON.stringify(item))))
        .map(item => JSON.parse(item));
    }

    // Remove duplicates based on key field
    const seen = new Set();
    return data.filter(item => {
      const key = item[keyField];
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Normalize data types in dataset
   */
  normalizeTypes(data: any, schema: Record<string, 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'>): any {
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeTypes(item, schema));
    }

    if (typeof data === 'object' && data !== null) {
      const normalized: any = {};
      for (const [key, value] of Object.entries(data)) {
        const targetType = schema[key];
        if (targetType) {
          normalized[key] = this.convertToType(value, targetType);
        } else {
          normalized[key] = value;
        }
      }
      return normalized;
    }

    return data;
  }

  /**
   * Convert value to target type
   */
  private convertToType(value: any, targetType: string): any {
    switch (targetType) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' ? value : { value };
      default:
        return value;
    }
  }

  /**
   * Extract URLs from data
   */
  private extractUrls(data: any): string[] {
    const urls: string[] = [];
    const urlRegex = /https?:\/\/[^\s]+/gi;
    
    const extractFromValue = (value: any) => {
      if (typeof value === 'string') {
        const matches = value.match(urlRegex);
        if (matches) urls.push(...matches);
      } else if (Array.isArray(value)) {
        value.forEach(extractFromValue);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(extractFromValue);
      }
    };

    extractFromValue(data);
    return [...new Set(urls)];
  }

  /**
   * Extract email addresses from data
   */
  private extractEmails(data: any): string[] {
    const emails: string[] = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    
    const extractFromValue = (value: any) => {
      if (typeof value === 'string') {
        const matches = value.match(emailRegex);
        if (matches) emails.push(...matches);
      } else if (Array.isArray(value)) {
        value.forEach(extractFromValue);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(extractFromValue);
      }
    };

    extractFromValue(data);
    return [...new Set(emails)];
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: any, path: string, value: any): any {
    const result = { ...obj };
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    let current = result;
    for (const key of keys) {
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
    return result;
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
  }

  /**
   * Extract form data from page
   */
  private async extractFormData(selector?: string): Promise<Record<string, any>> {
    const formSelector = selector || 'form';
    return await this.page.evaluate((sel) => {
      const form = document.querySelector(sel) as HTMLFormElement;
      if (!form) return {};

      const data: Record<string, any> = {};
      const elements = form.elements;

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLInputElement;
        if (element.name) {
          data[element.name] = element.value;
        }
      }

      return data;
    }, formSelector);
  }

  /**
   * Get input type for a field
   */
  private async getInputType(name: string): Promise<string> {
    return await this.page.evaluate((fieldName) => {
      const input = document.querySelector(`[name="${fieldName}"]`) as HTMLInputElement;
      return input?.type || 'text';
    }, name);
  }

  /**
   * Check if field is required
   */
  private async isFieldRequired(name: string): Promise<boolean> {
    return await this.page.evaluate((fieldName) => {
      const input = document.querySelector(`[name="${fieldName}"]`) as HTMLInputElement;
      return input?.required || false;
    }, name);
  }
}