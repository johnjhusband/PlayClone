const { PlayClone } = require('./dist');

async function debugTest() {
  const pc = new PlayClone({ headless: true });
  
  try {
    // Navigate to a simple page
    console.log('\n=== Navigating to example.com ===');
    await pc.navigate('https://example.com');
    
    // Test getText
    console.log('\n=== Testing getText ===');
    const textResult = await pc.getText();
    console.log('getText result:', JSON.stringify(textResult, null, 2));
    
    // Test getLinks  
    console.log('\n=== Testing getLinks ===');
    const linksResult = await pc.getLinks();
    console.log('getLinks result:', JSON.stringify(linksResult, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pc.close();
  }
}

debugTest();