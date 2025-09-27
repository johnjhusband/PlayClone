/**
 * Basic browser test to verify PlayClone is working
 */

const { PlayClone } = require('./dist/index.js');

async function testBasic() {
  let pc = null;
  try {
    console.log('Creating PlayClone instance...');
    pc = new PlayClone({ headless: true });
    console.log('✅ PlayClone created');
    
    console.log('Navigating to example.com...');
    const result = await pc.navigate('https://example.com');
    console.log('Navigation result:', result);
    
    console.log('Getting page text...');
    const text = await pc.getText();
    console.log('Text result:', text);
    
    console.log('✅ Basic test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (pc) {
      await pc.close();
    }
  }
}

testBasic();