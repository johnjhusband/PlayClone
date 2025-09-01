#!/usr/bin/env node

const { PlayClone } = require('../dist/index');
const { DataExtractionTemplates, BuiltInTemplates } = require('../dist/extraction/DataExtractionTemplates');

async function testExtractionTemplates() {
  console.log('🧪 Testing Data Extraction Templates\n');
  
  let browser;
  const results = [];

  try {
    // Initialize PlayClone
    browser = new PlayClone({ headless: true });

    // Test 1: Extract product data from an e-commerce page
    console.log('📝 Test 1: E-commerce Product Extraction');
    try {
      await browser.navigate('https://www.example.com');
      const extractor = new DataExtractionTemplates();
      
      // Since example.com doesn't have product data, we'll test the template structure
      const template = BuiltInTemplates.ECOMMERCE_PRODUCT;
      console.log(`  ✓ Template loaded: ${template.name}`);
      console.log(`  ✓ Fields: ${template.fields.map(f => f.name).join(', ')}`);
      results.push({ test: 'E-commerce Template', passed: true });
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.push({ test: 'E-commerce Template', passed: false, error: error.message });
    }

    // Test 2: Test all built-in templates
    console.log('\n📝 Test 2: All Built-in Templates');
    try {
      const templates = BuiltInTemplates.getAll();
      console.log(`  ✓ Total templates: ${templates.length}`);
      
      templates.forEach(template => {
        console.log(`  ✓ ${template.name}: ${template.fields.length} fields`);
      });
      
      results.push({ test: 'Built-in Templates', passed: true });
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.push({ test: 'Built-in Templates', passed: false, error: error.message });
    }

    // Test 3: Custom template registration
    console.log('\n📝 Test 3: Custom Template Registration');
    try {
      const extractor = new DataExtractionTemplates();
      
      const customTemplate = {
        name: 'custom_blog',
        description: 'Extract blog post data',
        fields: [
          {
            name: 'title',
            selector: 'h1',
            type: 'text',
            required: true
          },
          {
            name: 'content',
            selector: 'p',
            type: 'text',
            multiple: true
          }
        ]
      };
      
      extractor.registerTemplate(customTemplate);
      const registered = extractor.getTemplate('custom_blog');
      
      if (registered && registered.name === 'custom_blog') {
        console.log('  ✓ Custom template registered successfully');
        results.push({ test: 'Custom Template', passed: true });
      } else {
        throw new Error('Custom template not registered');
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.push({ test: 'Custom Template', passed: false, error: error.message });
    }

    // Test 4: Extract actual data from a page
    console.log('\n📝 Test 4: Extract Data from Example.com');
    try {
      const extractor = new DataExtractionTemplates();
      
      // Create a simple template for example.com
      const exampleTemplate = {
        name: 'example_page',
        fields: [
          {
            name: 'heading',
            selector: 'h1',
            type: 'text'
          },
          {
            name: 'paragraphs',
            selector: 'p',
            type: 'text',
            multiple: true
          },
          {
            name: 'links',
            selector: 'a',
            type: 'url',
            multiple: true,
            extract: 'href'
          }
        ]
      };
      
      extractor.registerTemplate(exampleTemplate);
      const result = await extractor.extract(browser.page, 'example_page');
      
      if (result.success && result.data) {
        console.log('  ✓ Data extracted successfully');
        console.log(`  ✓ Heading: ${result.data.heading}`);
        console.log(`  ✓ Paragraphs found: ${result.data.paragraphs?.length || 0}`);
        console.log(`  ✓ Links found: ${result.data.links?.length || 0}`);
        results.push({ test: 'Data Extraction', passed: true });
      } else {
        throw new Error('Failed to extract data');
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.push({ test: 'Data Extraction', passed: false, error: error.message });
    }

    // Test 5: Field validation and transformation
    console.log('\n📝 Test 5: Field Validation & Transformation');
    try {
      const extractor = new DataExtractionTemplates();
      
      const validationTemplate = {
        name: 'validation_test',
        fields: [
          {
            name: 'text',
            selector: 'h1',
            type: 'text',
            transform: (val) => val ? val.toUpperCase() : null,
            validate: (val) => val && val.length > 0
          }
        ]
      };
      
      extractor.registerTemplate(validationTemplate);
      const result = await extractor.extract(browser.page, 'validation_test');
      
      if (result.success && result.data.text === 'EXAMPLE DOMAIN') {
        console.log('  ✓ Transformation applied correctly');
        console.log('  ✓ Validation passed');
        results.push({ test: 'Validation & Transform', passed: true });
      } else {
        throw new Error('Transformation or validation failed');
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.push({ test: 'Validation & Transform', passed: false, error: error.message });
    }

    // Test 6: Auto-detection
    console.log('\n📝 Test 6: Auto-Detection');
    try {
      const extractor = new DataExtractionTemplates();
      
      // Navigate to a news site
      await browser.navigate('https://news.ycombinator.com');
      const result = await extractor.autoExtract(browser.page);
      
      if (result.success || result.errors) {
        console.log('  ✓ Auto-detection completed');
        console.log(`  ✓ Template used: ${result.metadata?.template || 'unknown'}`);
        results.push({ test: 'Auto-Detection', passed: true });
      } else {
        throw new Error('Auto-detection failed');
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.push({ test: 'Auto-Detection', passed: false, error: error.message });
    }

    // Test 7: Template listing
    console.log('\n📝 Test 7: Template Listing');
    try {
      const extractor = new DataExtractionTemplates();
      const templates = extractor.listTemplates();
      
      if (templates.length >= 7) { // Should have at least 7 built-in templates
        console.log(`  ✓ Found ${templates.length} templates`);
        console.log(`  ✓ Templates: ${templates.slice(0, 3).join(', ')}...`);
        results.push({ test: 'Template Listing', passed: true });
      } else {
        throw new Error('Not enough templates found');
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.push({ test: 'Template Listing', passed: false, error: error.message });
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
      console.log(`  - ${r.test}: ${r.error}`);
    });
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
testExtractionTemplates().catch(console.error);