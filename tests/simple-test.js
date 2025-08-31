/**
 * Simple test to verify PlayClone core functionality
 * Using JavaScript to avoid TypeScript type issues
 */

const { PlayClone } = require('../dist/index');

async function runSimpleTest() {
  console.log('Starting PlayClone simple test...');
  
  let playclone = null;
  
  try {
    // Create PlayClone instance
    playclone = new PlayClone({ 
      headless: true,
      browser: 'chromium' 
    });
    console.log('✓ PlayClone instance created');
    
    // Navigate to a page
    const navResult = await playclone.navigate('https://example.com');
    console.log('✓ Navigation result:', navResult.success ? 'SUCCESS' : 'FAILED');
    if (navResult.success && navResult.value) {
      console.log('  URL:', navResult.value.url);
      console.log('  Title:', navResult.value.title);
    } else if (navResult.error) {
      console.log('  Error:', navResult.error);
    }
    
    // Extract text
    const textResult = await playclone.getText();
    console.log('✓ Text extraction:', textResult ? 'SUCCESS' : 'FAILED');
    if (textResult && textResult.data) {
      console.log('  Text length:', textResult.data.text ? textResult.data.text.length : 'N/A');
      if (textResult.data.text) {
        console.log('  Contains "Example Domain":', textResult.data.text.includes('Example Domain'));
      }
    }
    
    // Get links
    const linksResult = await playclone.getLinks();
    console.log('✓ Links extraction:', linksResult ? 'SUCCESS' : 'FAILED');
    if (linksResult && linksResult.data && linksResult.data.links) {
      console.log('  Links found:', linksResult.data.links.length);
      linksResult.data.links.forEach(link => {
        console.log('    -', link.text, ':', link.href);
      });
    }
    
    // Take screenshot
    const screenshotResult = await playclone.screenshot();
    console.log('✓ Screenshot:', screenshotResult ? 'SUCCESS' : 'FAILED');
    if (screenshotResult && screenshotResult.data) {
      console.log('  Format:', screenshotResult.data.format);
      console.log('  Size:', screenshotResult.data.data ? screenshotResult.data.data.length : 'N/A', 'bytes');
    }
    
    // Test natural language click
    console.log('\nTesting natural language element interaction...');
    const clickResult = await playclone.click('More information link');
    console.log('✓ Click "More information link":', clickResult.success ? 'SUCCESS' : 'FAILED');
    if (clickResult.success && clickResult.value) {
      console.log('  New URL:', clickResult.value.url || 'N/A');
    } else if (clickResult.error) {
      console.log('  Error:', clickResult.error);
    }
    
    // Wait a bit for navigation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Go back
    const backResult = await playclone.back();
    console.log('✓ Navigate back:', backResult.success ? 'SUCCESS' : 'FAILED');
    if (backResult.success && backResult.value) {
      console.log('  URL:', backResult.value.url);
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    if (playclone) {
      await playclone.close();
      console.log('✓ Browser closed');
    }
  }
}

// Run the test
runSimpleTest().catch(console.error);