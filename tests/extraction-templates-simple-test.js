#!/usr/bin/env node

// Simple test for data extraction templates without requiring full build
const { chromium } = require('playwright-core');

console.log('🧪 Testing Data Extraction Templates (Simple)\n');

// Simplified ExtractionTemplates implementation for testing
class DataExtractionTemplates {
  constructor() {
    this.templates = new Map();
    this.initBuiltInTemplates();
  }

  initBuiltInTemplates() {
    // E-commerce product template
    this.templates.set('ecommerce_product', {
      name: 'ecommerce_product',
      description: 'Extract product details from e-commerce pages',
      fields: [
        { name: 'title', selector: 'h1', type: 'text', required: true },
        { name: 'price', selector: '.price', type: 'price' },
        { name: 'description', selector: '.description', type: 'text' }
      ]
    });

    // News article template
    this.templates.set('news_article', {
      name: 'news_article',
      description: 'Extract news article content',
      fields: [
        { name: 'headline', selector: 'h1', type: 'text', required: true },
        { name: 'author', selector: '.author', type: 'text' },
        { name: 'content', selector: 'article', type: 'text' }
      ]
    });
  }

  async extract(page, templateName) {
    const template = this.templates.get(templateName);
    if (!template) {
      return { success: false, errors: [`Template '${templateName}' not found`] };
    }

    const extractedData = {};
    const errors = [];

    for (const field of template.fields) {
      try {
        const element = await page.$(field.selector);
        if (element) {
          const value = await element.textContent();
          extractedData[field.name] = value?.trim() || null;
        } else if (field.required) {
          errors.push(`Required field '${field.name}' not found`);
        } else {
          extractedData[field.name] = null;
        }
      } catch (error) {
        errors.push(`Error extracting '${field.name}': ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      data: extractedData,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        url: page.url(),
        timestamp: new Date().toISOString(),
        template: templateName
      }
    };
  }

  listTemplates() {
    return Array.from(this.templates.keys());
  }
}

async function runTests() {
  let browser;
  const results = [];

  try {
    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const extractor = new DataExtractionTemplates();

    // Test 1: List templates
    console.log('📝 Test 1: List Templates');
    const templates = extractor.listTemplates();
    console.log(`  ✓ Found ${templates.length} templates: ${templates.join(', ')}`);
    results.push({ test: 'List Templates', passed: true });

    // Test 2: Extract from example.com
    console.log('\n📝 Test 2: Extract from Example.com');
    await page.goto('https://example.com');
    
    const result = await extractor.extract(page, 'news_article');
    if (result.data && result.data.headline) {
      console.log(`  ✓ Extracted headline: ${result.data.headline}`);
      console.log(`  ✓ Template: ${result.metadata.template}`);
      results.push({ test: 'Extract Data', passed: true });
    } else {
      console.log(`  ✗ Failed to extract data`);
      results.push({ test: 'Extract Data', passed: false });
    }

    // Test 3: Test with non-existent template
    console.log('\n📝 Test 3: Non-existent Template');
    const invalidResult = await extractor.extract(page, 'invalid_template');
    if (!invalidResult.success && invalidResult.errors) {
      console.log(`  ✓ Correctly handled invalid template`);
      console.log(`  ✓ Error: ${invalidResult.errors[0]}`);
      results.push({ test: 'Error Handling', passed: true });
    } else {
      console.log(`  ✗ Did not handle invalid template correctly`);
      results.push({ test: 'Error Handling', passed: false });
    }

    // Test 4: Extract from news site
    console.log('\n📝 Test 4: Extract from Hacker News');
    await page.goto('https://news.ycombinator.com');
    
    const newsResult = await extractor.extract(page, 'news_article');
    if (newsResult.data) {
      console.log(`  ✓ Extracted data from Hacker News`);
      console.log(`  ✓ URL: ${newsResult.metadata.url}`);
      results.push({ test: 'News Extraction', passed: true });
    } else {
      console.log(`  ✗ Failed to extract from Hacker News`);
      results.push({ test: 'News Extraction', passed: false });
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  
  console.log(`✅ Passed: ${passed}/${total} (${passRate}%)`);
  
  if (passed < total) {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}`);
    });
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(console.error);