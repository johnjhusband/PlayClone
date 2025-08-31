const { PlayClone } = require('./dist');

async function debugBackText() {
  const pc = new PlayClone({ headless: true });
  
  try {
    // Navigate to example.com
    console.log('\n1. Navigating to example.com...');
    await pc.navigate('https://example.com');
    
    // Click "More information"
    console.log('\n2. Clicking "More information"...');
    const clickResult = await pc.click('More information');
    console.log('Click result:', clickResult.success);
    
    // Wait for navigation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get current URL
    console.log('\n3. Current URL after click:');
    const page = pc.page;
    if (page) {
      console.log('URL:', await page.url());
    }
    
    // Go back
    console.log('\n4. Going back...');
    const backResult = await pc.back();
    console.log('Back result:', backResult.success);
    
    // Wait for navigation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get current URL after back
    console.log('\n5. Current URL after back:');
    if (page) {
      console.log('URL:', await page.url());
    }
    
    // Try to get text
    console.log('\n6. Getting text from page...');
    const textResult = await pc.getText();
    console.log('Text result success:', textResult.data?.text ? true : false);
    console.log('Text content:', textResult.data?.text ? textResult.data.text.substring(0, 100) + '...' : 'null');
    
    // Try waiting and getting text again
    console.log('\n7. Waiting 2 seconds and trying again...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const textResult2 = await pc.getText();
    console.log('Text result success:', textResult2.data?.text ? true : false);
    console.log('Text content:', textResult2.data?.text ? textResult2.data.text.substring(0, 100) + '...' : 'null');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pc.close();
  }
}

debugBackText();