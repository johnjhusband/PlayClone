/**
 * Test for Data Validation and Sanitization
 */

const { PlayClone } = require('../dist');

console.log('🧪 Testing Data Validation and Sanitization\n');

async function runTests() {
  const pc = new PlayClone({ headless: true });
  
  try {
    // Navigate to a test page
    console.log('📍 Navigating to example.com...');
    await pc.navigate('https://example.com');
    
    // Test 1: Validate data with rules
    console.log('\n✅ Test 1: Validate data with rules');
    const sampleData = {
      email: 'user@example.com',
      url: 'https://example.com',
      phone: '+1-555-123-4567',
      name: 'John Doe',
      age: '25'
    };
    
    const validationRules = [
      {
        field: 'email',
        rules: [
          { type: 'required' },
          { type: 'email' }
        ],
        sanitize: true
      },
      {
        field: 'url',
        rules: [
          { type: 'required' },
          { type: 'url' }
        ]
      },
      {
        field: 'phone',
        rules: [
          { type: 'phone' }
        ]
      },
      {
        field: 'age',
        rules: [
          { type: 'number' }
        ],
        transform: (value) => Number(value)
      }
    ];
    
    const validationResult = await pc.validateData(sampleData, validationRules);
    console.log('Validation result:', validationResult.data.valid ? '✅ Valid' : '❌ Invalid');
    if (validationResult.data.errors?.length > 0) {
      console.log('Errors:', validationResult.data.errors);
    }
    
    // Test 2: Sanitize HTML content
    console.log('\n✅ Test 2: Sanitize HTML content');
    const htmlContent = {
      title: '<h1>Title with <script>alert("XSS")</script></h1>',
      description: 'Normal text with <b>bold</b> and <i>italic</i>',
      code: '<code>console.log("test")</code>',
      dangerous: '<img src=x onerror="alert(1)">'
    };
    
    const sanitized = await pc.sanitizeData(htmlContent, {
      removeHtml: true,
      trimWhitespace: true,
      normalizeWhitespace: true
    });
    console.log('Original title:', htmlContent.title);
    console.log('Sanitized title:', sanitized.data.title);
    
    // Test 3: Validate URLs
    console.log('\n✅ Test 3: Validate URLs');
    const mixedUrls = [
      'https://example.com',
      'http://google.com',
      'not-a-url',
      'ftp://files.example.com',
      'https://invalid url with spaces.com'
    ];
    
    const urlValidation = await pc.validateUrls(mixedUrls);
    console.log('Valid URLs:', urlValidation.data.valid.length);
    console.log('Invalid URLs:', urlValidation.data.invalid.length);
    
    // Test 4: Validate emails
    console.log('\n✅ Test 4: Validate emails');
    const emails = [
      'valid@email.com',
      'another.valid@domain.co.uk',
      'invalid@',
      'not-an-email',
      'missing@domain'
    ];
    
    const emailValidation = await pc.validateEmails(emails);
    console.log('Valid emails:', emailValidation.data.valid);
    console.log('Invalid emails:', emailValidation.data.invalid);
    
    // Test 5: Remove duplicates
    console.log('\n✅ Test 5: Remove duplicates');
    const duplicateData = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 1, name: 'Item 1' },
      { id: 3, name: 'Item 3' },
      { id: 2, name: 'Item 2' }
    ];
    
    const deduped = await pc.removeDuplicates(duplicateData, 'id');
    console.log('Original items:', duplicateData.length);
    console.log('After deduplication:', deduped.data.length);
    
    // Test 6: Normalize data types
    console.log('\n✅ Test 6: Normalize data types');
    const mixedTypes = {
      age: '25',
      active: 'true',
      score: '98.5',
      date: '2024-01-01',
      tags: 'tag1,tag2,tag3'
    };
    
    const schema = {
      age: 'number',
      active: 'boolean',
      score: 'number',
      date: 'date',
      tags: 'string'
    };
    
    const normalized = await pc.normalizeTypes(mixedTypes, schema);
    console.log('Original age type:', typeof mixedTypes.age);
    console.log('Normalized age type:', typeof normalized.data.age);
    console.log('Normalized active:', normalized.data.active);
    
    // Test 7: Custom validator
    console.log('\n✅ Test 7: Custom validator');
    await pc.registerValidator('strongPassword', (value) => {
      // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      return regex.test(value);
    });
    
    const passwordData = {
      password: 'Test123!'
    };
    
    const passwordRules = [
      {
        field: 'password',
        rules: [
          { type: 'required' },
          { type: 'custom', options: { validator: 'strongPassword' } }
        ]
      }
    ];
    
    await pc.addValidationRules('passwordValidation', passwordRules);
    const passwordResult = await pc.validateData(passwordData, 'passwordValidation');
    console.log('Password validation:', passwordResult.data.valid ? '✅ Strong' : '❌ Weak');
    
    // Test 8: Sanitize with specific options
    console.log('\n✅ Test 8: Advanced sanitization');
    const advancedContent = {
      html: '<p>Keep this</p><script>Remove this</script><b>Keep bold</b>',
      special: 'Text with @#$% special chars!',
      long: 'This is a very long text that should be truncated after a certain number of characters for display purposes'
    };
    
    const advancedSanitized = await pc.sanitizeData(advancedContent, {
      allowedTags: ['p', 'b', 'i'],
      removeSpecialChars: false,
      maxLength: 50,
      encoding: 'escape'
    });
    
    console.log('Sanitized HTML (allowed tags):', advancedSanitized.data.html);
    console.log('Truncated text:', advancedSanitized.data.long);
    
    console.log('\n✅ All data validation tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pc.close();
  }
}

runTests().catch(console.error);