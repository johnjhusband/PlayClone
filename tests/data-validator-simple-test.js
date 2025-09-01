/**
 * Simple test for DataValidator class directly
 */

const { DataValidator } = require('../dist/data/DataValidator');
const { chromium } = require('playwright-core');

console.log('🧪 Testing DataValidator directly\n');

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    const validator = new DataValidator(page);
    
    // Test 1: Basic validation
    console.log('✅ Test 1: Basic validation');
    const data = {
      email: 'test@example.com',
      phone: '+1-555-123-4567',
      age: '25'
    };
    
    const rules = [
      {
        field: 'email',
        rules: [{ type: 'required' }, { type: 'email' }]
      },
      {
        field: 'phone',
        rules: [{ type: 'phone' }]
      },
      {
        field: 'age',
        rules: [{ type: 'number' }]
      }
    ];
    
    const result = validator.validate(data, rules);
    console.log('Valid:', result.valid);
    console.log('Errors:', result.errors);
    
    // Test 2: Sanitization
    console.log('\n✅ Test 2: Sanitization');
    const htmlData = '<script>alert("XSS")</script>Hello <b>World</b>';
    const sanitized = validator.sanitizeValue(htmlData);
    console.log('Original:', htmlData);
    console.log('Sanitized:', sanitized);
    
    // Test 3: URL validation
    console.log('\n✅ Test 3: URL validation');
    const urls = {
      links: ['https://example.com', 'not-a-url', 'http://google.com']
    };
    const urlResult = validator.validateUrls(urls);
    console.log('Valid URLs:', urlResult.valid);
    console.log('Invalid URLs:', urlResult.invalid);
    
    // Test 4: Email validation
    console.log('\n✅ Test 4: Email validation');
    const emails = {
      contacts: ['user@example.com', 'invalid@', 'another@test.org']
    };
    const emailResult = validator.validateEmails(emails);
    console.log('Valid emails:', emailResult.valid);
    console.log('Invalid emails:', emailResult.invalid);
    
    // Test 5: Remove duplicates
    console.log('\n✅ Test 5: Remove duplicates');
    const duplicates = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 1, name: 'Item 1' }
    ];
    const unique = validator.removeDuplicates(duplicates, 'id');
    console.log('Original count:', duplicates.length);
    console.log('Unique count:', unique.length);
    
    // Test 6: Type normalization
    console.log('\n✅ Test 6: Type normalization');
    const mixed = {
      age: '30',
      active: 'true',
      score: '95.5'
    };
    const schema = {
      age: 'number',
      active: 'boolean',
      score: 'number'
    };
    const normalized = validator.normalizeTypes(mixed, schema);
    console.log('Age type:', typeof normalized.age, '- value:', normalized.age);
    console.log('Active type:', typeof normalized.active, '- value:', normalized.active);
    console.log('Score type:', typeof normalized.score, '- value:', normalized.score);
    
    // Test 7: Custom validator
    console.log('\n✅ Test 7: Custom validator');
    validator.registerValidator('strongPassword', (value) => {
      return value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);
    });
    
    const passwordData = { password: 'Test123!' };
    const passwordRules = [{
      field: 'password',
      rules: [
        { type: 'required' },
        { type: 'custom', options: { validator: 'strongPassword' } }
      ]
    }];
    
    const pwResult = validator.validate(passwordData, passwordRules);
    console.log('Password valid:', pwResult.valid);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);