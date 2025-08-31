/**
 * Test form filling with local HTML file
 */

const { PlayClone } = require('../dist/index');
const path = require('path');

async function testLocalForm() {
  const pc = new PlayClone({ headless: true });
  
  try {
    // Navigate to local test form
    const formPath = 'file://' + path.resolve(__dirname, 'test-simple-form.html');
    console.log('Navigating to test form:', formPath);
    await pc.navigate(formPath);
    
    // Test various form operations
    console.log('\nTesting form operations:');
    
    // Fill username
    let result = await pc.fill('username', 'testuser');
    console.log('Fill username:', result.success ? '✓' : '✗', result.error || '');
    
    // Fill email
    result = await pc.fill('email', 'test@example.com');
    console.log('Fill email:', result.success ? '✓' : '✗', result.error || '');
    
    // Fill password
    result = await pc.fill('password', 'secret123');
    console.log('Fill password:', result.success ? '✓' : '✗', result.error || '');
    
    // Fill search
    result = await pc.fill('search', 'PlayClone test');
    console.log('Fill search:', result.success ? '✓' : '✗', result.error || '');
    
    // Fill textarea
    result = await pc.fill('comments', 'This is a test comment');
    console.log('Fill comments:', result.success ? '✓' : '✗', result.error || '');
    
    // Select dropdown
    result = await pc.select('country', 'Canada');
    console.log('Select country:', result.success ? '✓' : '✗', result.error || '');
    
    // Check checkbox
    result = await pc.check('agree');
    console.log('Check agree:', result.success ? '✓' : '✗', result.error || '');
    
    // Get form data to verify
    const formData = await pc.getFormData();
    console.log('\nForm data:', JSON.stringify(formData.data, null, 2));
    
  } finally {
    await pc.close();
  }
}

testLocalForm().catch(console.error);