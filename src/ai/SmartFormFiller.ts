/**
 * Smart Form Filling with Field Type Detection
 * Intelligently fills forms by detecting field types and generating appropriate data
 */

import { Page } from 'playwright-core';
import { ActionResult } from '../types';
import { formatResponse, formatError } from '../utils/responseFormatter';

export interface FormField {
  name?: string;
  id?: string;
  type: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  value?: any;
  options?: string[]; // For select/radio/checkbox
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  detectedType?: string; // AI-detected semantic type
  suggestedValue?: any;
}

export interface FormAnalysis {
  fields: FormField[];
  formType?: string; // login, registration, checkout, contact, etc.
  confidence: number;
  suggestions: Record<string, any>;
}

export interface FillOptions {
  useDefaults?: boolean;
  generateFakeData?: boolean;
  respectValidation?: boolean;
  interactionDelay?: number;
  customData?: Record<string, any>;
}

export class SmartFormFiller {
  private page: Page;
  private commonPatterns: Map<string, RegExp[]>;
  private fakeDataGenerators: Map<string, () => any>;

  constructor(page: Page) {
    this.page = page;
    this.commonPatterns = this.initializePatterns();
    this.fakeDataGenerators = this.initializeGenerators();
  }

  /**
   * Initialize field detection patterns
   */
  private initializePatterns(): Map<string, RegExp[]> {
    const patterns = new Map<string, RegExp[]>();

    patterns.set('email', [
      /email/i,
      /e-mail/i,
      /mail/i,
      /correo/i,
      /courriel/i
    ]);

    patterns.set('password', [
      /password/i,
      /passwd/i,
      /pass/i,
      /pwd/i,
      /secret/i,
      /contraseña/i
    ]);

    patterns.set('username', [
      /username/i,
      /user/i,
      /login/i,
      /usuario/i,
      /nickname/i
    ]);

    patterns.set('firstname', [
      /first.*name/i,
      /fname/i,
      /given.*name/i,
      /prenom/i,
      /nombre/i
    ]);

    patterns.set('lastname', [
      /last.*name/i,
      /lname/i,
      /surname/i,
      /family.*name/i,
      /apellido/i
    ]);

    patterns.set('fullname', [
      /full.*name/i,
      /name/i,
      /your.*name/i,
      /nombre.*completo/i
    ]);

    patterns.set('phone', [
      /phone/i,
      /tel/i,
      /mobile/i,
      /cell/i,
      /telefono/i,
      /numero/i
    ]);

    patterns.set('address', [
      /address/i,
      /street/i,
      /direccion/i,
      /adresse/i,
      /location/i
    ]);

    patterns.set('city', [
      /city/i,
      /town/i,
      /ciudad/i,
      /ville/i,
      /locality/i
    ]);

    patterns.set('zipcode', [
      /zip/i,
      /postal/i,
      /postcode/i,
      /codigo.*postal/i,
      /plz/i
    ]);

    patterns.set('country', [
      /country/i,
      /nation/i,
      /pais/i,
      /pays/i,
      /land/i
    ]);

    patterns.set('creditcard', [
      /card.*number/i,
      /credit.*card/i,
      /cc.*num/i,
      /tarjeta/i,
      /payment.*card/i
    ]);

    patterns.set('cvv', [
      /cvv/i,
      /cvc/i,
      /security.*code/i,
      /card.*code/i,
      /verification/i
    ]);

    patterns.set('date', [
      /date/i,
      /fecha/i,
      /datum/i,
      /when/i
    ]);

    patterns.set('birthdate', [
      /birth/i,
      /dob/i,
      /born/i,
      /birthday/i,
      /nacimiento/i
    ]);

    patterns.set('age', [
      /age/i,
      /edad/i,
      /years.*old/i
    ]);

    patterns.set('gender', [
      /gender/i,
      /sex/i,
      /male.*female/i,
      /genero/i
    ]);

    patterns.set('company', [
      /company/i,
      /organization/i,
      /business/i,
      /empresa/i,
      /org/i
    ]);

    patterns.set('website', [
      /website/i,
      /url/i,
      /site/i,
      /web/i,
      /homepage/i
    ]);

    patterns.set('message', [
      /message/i,
      /comment/i,
      /description/i,
      /text/i,
      /note/i,
      /mensaje/i
    ]);

    return patterns;
  }

  /**
   * Initialize fake data generators
   */
  private initializeGenerators(): Map<string, () => any> {
    const generators = new Map<string, () => any>();

    generators.set('email', () => {
      const timestamp = Date.now();
      return `user${timestamp}@example.com`;
    });

    generators.set('password', () => {
      return 'Test@123456';
    });

    generators.set('username', () => {
      return `user_${Date.now()}`;
    });

    generators.set('firstname', () => {
      const names = ['John', 'Jane', 'Alex', 'Sarah', 'Mike', 'Emma'];
      return names[Math.floor(Math.random() * names.length)];
    });

    generators.set('lastname', () => {
      const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'];
      return names[Math.floor(Math.random() * names.length)];
    });

    generators.set('fullname', () => {
      return `${generators.get('firstname')!()} ${generators.get('lastname')!()}`;
    });

    generators.set('phone', () => {
      return `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
    });

    generators.set('address', () => {
      return `${Math.floor(Math.random() * 9999) + 1} Main Street`;
    });

    generators.set('city', () => {
      const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
      return cities[Math.floor(Math.random() * cities.length)];
    });

    generators.set('zipcode', () => {
      return `${Math.floor(Math.random() * 90000) + 10000}`;
    });

    generators.set('country', () => {
      return 'United States';
    });

    generators.set('creditcard', () => {
      // Test credit card number (not real)
      return '4111111111111111';
    });

    generators.set('cvv', () => {
      return `${Math.floor(Math.random() * 900) + 100}`;
    });

    generators.set('date', () => {
      const date = new Date();
      return date.toISOString().split('T')[0];
    });

    generators.set('birthdate', () => {
      const year = 1970 + Math.floor(Math.random() * 30);
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    });

    generators.set('age', () => {
      return Math.floor(Math.random() * 50) + 18;
    });

    generators.set('gender', () => {
      return Math.random() > 0.5 ? 'male' : 'female';
    });

    generators.set('company', () => {
      const companies = ['Acme Corp', 'Tech Solutions', 'Global Industries', 'Digital Services'];
      return companies[Math.floor(Math.random() * companies.length)];
    });

    generators.set('website', () => {
      return `https://example${Date.now()}.com`;
    });

    generators.set('message', () => {
      return 'This is a test message generated by automated form filling.';
    });

    return generators;
  }

  /**
   * Analyze form and detect field types
   */
  async analyzeForm(formSelector?: string): Promise<ActionResult> {
    try {
      const analysis = await this.page.evaluate((selector) => {
        const form = selector ? document.querySelector(selector) : document.querySelector('form');
        if (!form) {
          // Look for form-like structures
          const inputs = document.querySelectorAll('input, textarea, select');
          if (inputs.length === 0) {
            return null;
          }
        }

        const fields: any[] = [];
        const elements = form ? 
          form.querySelectorAll('input, textarea, select') :
          document.querySelectorAll('input, textarea, select');

        elements.forEach((element: any) => {
          // Skip hidden fields and buttons
          if (element.type === 'hidden' || element.type === 'submit' || element.type === 'button') {
            return;
          }

          const field: any = {
            name: element.name || undefined,
            id: element.id || undefined,
            type: element.type || element.tagName.toLowerCase(),
            required: element.required || element.hasAttribute('required'),
            placeholder: element.placeholder || undefined,
            value: element.value || undefined
          };

          // Get label
          let label = '';
          if (element.id) {
            const labelEl = document.querySelector(`label[for="${element.id}"]`);
            if (labelEl) {
              label = labelEl.textContent?.trim() || '';
            }
          }
          if (!label) {
            // Try to find parent label
            const parentLabel = element.closest('label');
            if (parentLabel) {
              label = parentLabel.textContent?.trim() || '';
            }
          }
          field.label = label || undefined;

          // Get validation attributes
          const validation: any = {};
          if (element.pattern) validation.pattern = element.pattern;
          if (element.minLength) validation.minLength = element.minLength;
          if (element.maxLength) validation.maxLength = element.maxLength;
          if (element.min) validation.min = element.min;
          if (element.max) validation.max = element.max;
          
          if (Object.keys(validation).length > 0) {
            field.validation = validation;
          }

          // Get options for select/radio/checkbox
          if (element.tagName === 'SELECT') {
            field.options = Array.from(element.options).map((opt: any) => opt.value);
          }

          fields.push(field);
        });

        return fields;
      }, formSelector);

      if (!analysis) {
        return formatResponse({
          success: true,
          action: 'analyzeForm',
          timestamp: Date.now(),
          value: {
            found: false,
            message: 'No form found on the page'
          }
        });
      }

      // Detect field types
      const fieldsWithTypes = analysis.map(field => {
        const detectedType = this.detectFieldType(field);
        return {
          ...field,
          detectedType,
          suggestedValue: this.fakeDataGenerators.get(detectedType)?.()} ;
      });

      // Detect form type
      const formType = this.detectFormType(fieldsWithTypes);

      // Generate suggestions
      const suggestions: Record<string, any> = {};
      fieldsWithTypes.forEach(field => {
        const key = field.name || field.id || `field_${Math.random()}`;
        suggestions[key] = field.suggestedValue;
      });

      return formatResponse({
        success: true,
        action: 'analyzeForm',
        value: {
          fields: fieldsWithTypes,
          formType,
          confidence: 0.8,
          suggestions
        },
        timestamp: Date.now()
      });

    } catch (error) {
      return formatError(error as Error, 'Failed to analyze form');
    }
  }

  /**
   * Detect semantic field type
   */
  private detectFieldType(field: FormField): string {
    const searchText = `${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`.toLowerCase();

    for (const [type, patterns] of this.commonPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(searchText)) {
          return type;
        }
      }
    }

    // Check HTML5 input types
    if (field.type === 'email') return 'email';
    if (field.type === 'tel') return 'phone';
    if (field.type === 'url') return 'website';
    if (field.type === 'number' && searchText.includes('age')) return 'age';
    if (field.type === 'date') return searchText.includes('birth') ? 'birthdate' : 'date';

    // Default based on field type
    if (field.type === 'textarea') return 'message';
    if (field.type === 'select' && searchText.includes('country')) return 'country';
    if (field.type === 'select' && searchText.includes('gender')) return 'gender';

    return 'text';
  }

  /**
   * Detect form type
   */
  private detectFormType(fields: FormField[]): string {
    const fieldTypes = fields.map(f => f.detectedType).filter(Boolean);

    // Login form
    if (fieldTypes.includes('email') || fieldTypes.includes('username')) {
      if (fieldTypes.includes('password') && fields.length <= 4) {
        return 'login';
      }
    }

    // Registration form
    if (fieldTypes.includes('email') && fieldTypes.includes('password')) {
      if (fieldTypes.includes('firstname') || fieldTypes.includes('lastname') || fields.length > 4) {
        return 'registration';
      }
    }

    // Checkout form
    if (fieldTypes.includes('creditcard') || fieldTypes.includes('cvv')) {
      return 'checkout';
    }

    // Contact form
    if (fieldTypes.includes('message') && (fieldTypes.includes('email') || fieldTypes.includes('phone'))) {
      return 'contact';
    }

    // Profile form
    if (fieldTypes.includes('firstname') || fieldTypes.includes('lastname')) {
      if (!fieldTypes.includes('password')) {
        return 'profile';
      }
    }

    // Address form
    if (fieldTypes.includes('address') && fieldTypes.includes('city')) {
      return 'address';
    }

    // Search form
    if (fields.length === 1 && fields[0].type === 'text') {
      return 'search';
    }

    return 'generic';
  }

  /**
   * Fill form intelligently
   */
  async fillForm(options: FillOptions = {}): Promise<ActionResult> {
    const {
      useDefaults = true,
      generateFakeData = true,
      respectValidation = true,
      interactionDelay = 100,
      customData = {}
    } = options;

    try {
      // Analyze form first
      const analysisResult = await this.analyzeForm();
      if (!analysisResult.success || !analysisResult.value?.fields) {
        return analysisResult;
      }

      const analysis = analysisResult.value as FormAnalysis;
      const filledFields: Array<{ field: string; value: any; success: boolean }> = [];

      // Fill each field
      for (const field of analysis.fields) {
        const fieldIdentifier = field.id || field.name || '';
        let value = customData[fieldIdentifier];

        // Generate value if not provided
        if (value === undefined && generateFakeData) {
          value = field.suggestedValue;
        }

        // Use default value if still undefined
        if (value === undefined && useDefaults && field.placeholder) {
          value = field.placeholder;
        }

        if (value !== undefined) {
          try {
            // Find element
            const selector = field.id ? `#${field.id}` : 
                           field.name ? `[name="${field.name}"]` : null;
            
            if (!selector) continue;

            // Fill based on type
            if (field.type === 'select') {
              await this.page.selectOption(selector, value);
            } else if (field.type === 'checkbox' || field.type === 'radio') {
              const element = await this.page.$(selector);
              if (element) {
                const isChecked = await element.isChecked();
                if (value && !isChecked) {
                  await element.check();
                } else if (!value && isChecked) {
                  await element.uncheck();
                }
              }
            } else {
              // Text input
              await this.page.fill(selector, String(value));
              
              // Validate if needed
              if (respectValidation && field.validation) {
                const isValid = await this.validateField(selector, value, field.validation);
                if (!isValid) {
                  // Try to fix the value
                  value = this.fixValidation(value, field.validation);
                  await this.page.fill(selector, String(value));
                }
              }
            }

            filledFields.push({
              field: fieldIdentifier,
              value,
              success: true
            });

            // Add interaction delay
            if (interactionDelay > 0) {
              await this.page.waitForTimeout(interactionDelay);
            }

          } catch (error) {
            filledFields.push({
              field: fieldIdentifier,
              value,
              success: false
            });
          }
        }
      }

      return formatResponse({
        success: true,
        action: 'fillForm',
        timestamp: Date.now(),
        value: {
          formType: analysis.formType,
          filledCount: filledFields.filter(f => f.success).length,
          totalFields: analysis.fields.length,
          fields: filledFields
        }
      });

    } catch (error) {
      return formatError(error as Error, 'Failed to fill form');
    }
  }

  /**
   * Validate field value
   */
  private async validateField(selector: string, value: any, validation: any): Promise<boolean> {
    return this.page.evaluate((args: {sel: string, val: any, rules: any}) => {
      const { sel, val, rules } = args;
      const element = document.querySelector(sel) as any;
      if (!element) return false;

      // Check pattern
      if (rules.pattern) {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(String(val))) return false;
      }

      // Check length
      const strVal = String(val);
      if (rules.minLength && strVal.length < rules.minLength) return false;
      if (rules.maxLength && strVal.length > rules.maxLength) return false;

      // Check numeric range
      if (element.type === 'number') {
        const numVal = Number(val);
        if (rules.min && numVal < rules.min) return false;
        if (rules.max && numVal > rules.max) return false;
      }

      return true;
    }, { sel: selector, val: value, rules: validation });
  }

  /**
   * Fix value to match validation rules
   */
  private fixValidation(value: any, validation: any): any {
    let fixed = String(value);

    // Fix length
    if (validation.minLength && fixed.length < validation.minLength) {
      fixed = fixed.padEnd(validation.minLength, '0');
    }
    if (validation.maxLength && fixed.length > validation.maxLength) {
      fixed = fixed.substring(0, validation.maxLength);
    }

    // Fix numeric range
    if (validation.min !== undefined || validation.max !== undefined) {
      let num = Number(fixed);
      if (!isNaN(num)) {
        if (validation.min && num < validation.min) num = validation.min;
        if (validation.max && num > validation.max) num = validation.max;
        fixed = String(num);
      }
    }

    return fixed;
  }

  /**
   * Submit form
   */
  async submitForm(formSelector?: string): Promise<ActionResult> {
    try {
      // Find submit button
      const submitButton = await this.page.evaluate((selector) => {
        const form = selector ? document.querySelector(selector) : document.querySelector('form');
        
        // Look for submit button in form
        if (form) {
          const submit = form.querySelector('button[type="submit"], input[type="submit"]');
          if (submit) return { found: true, selector: null };
        }

        // Look for any submit button
        const submits = document.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])');
        for (let i = 0; i < submits.length; i++) {
          const btn = submits[i];
          const text = (btn.textContent || '').toLowerCase();
          if (text.includes('submit') || text.includes('send') || text.includes('login') || text.includes('register')) {
            return { found: true, selector: null };
          }
        }

        return { found: false, selector: null };
      }, formSelector);

      if (!submitButton.found) {
        // Try to submit form directly
        if (formSelector) {
          await this.page.evaluate((sel) => {
            const form = document.querySelector(sel) as any;
            if (form && form.submit) {
              form.submit();
            }
          }, formSelector);
        }

        return formatResponse({
        success: true,
        action: 'ai_operation',
        timestamp: Date.now(),
        value: {
          submitted: true,
          method: 'form.submit()'
        }
      });
      }

      // Click submit button
      await this.page.click('button[type="submit"], input[type="submit"]');

      return formatResponse({
        success: true,
        action: 'ai_operation',
        timestamp: Date.now(),
        value: {
          submitted: true,
          method: 'button.click()'
        }
      });

    } catch (error) {
      return formatError(error as Error, 'Failed to submit form');
    }
  }
}
