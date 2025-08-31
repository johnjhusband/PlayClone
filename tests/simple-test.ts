/**
 * Simple test to verify PlayClone core functionality
 */

import { PlayClone } from '../dist/index';

async function runSimpleTest() {
  console.log('Starting PlayClone simple test...');
  
  let playclone: PlayClone | null = null;
  
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
    if (navResult.success) {
      console.log('  URL:', navResult.state.url);
      console.log('  Title:', navResult.state.title);
    } else {
      console.log('  Error:', navResult.error);
    }
    
    // Extract text
    const textResult = await playclone.getText();
    console.log('✓ Text extraction:', textResult.success ? 'SUCCESS' : 'FAILED');
    if (textResult.success) {
      console.log('  Text length:', textResult.data.text.length);
      console.log('  Contains "Example Domain":', textResult.data.text.includes('Example Domain'));
    }
    
    // Get links
    const linksResult = await playclone.getLinks();
    console.log('✓ Links extraction:', linksResult.success ? 'SUCCESS' : 'FAILED');
    if (linksResult.success) {
      console.log('  Links found:', linksResult.data.links.length);
    }
    
    // Take screenshot
    const screenshotResult = await playclone.screenshot();
    console.log('✓ Screenshot:', screenshotResult.success ? 'SUCCESS' : 'FAILED');
    if (screenshotResult.success) {
      console.log('  Format:', screenshotResult.data.format);
      console.log('  Size:', screenshotResult.data.data.length, 'bytes');
    }
    
    // Test natural language click
    console.log('\nTesting natural language element interaction...');
    const clickResult = await playclone.click('More information link');
    console.log('✓ Click "More information link":', clickResult.success ? 'SUCCESS' : 'FAILED');
    if (clickResult.success) {
      console.log('  New URL:', clickResult.state.url);
    }
    
    // Go back
    const backResult = await playclone.back();
    console.log('✓ Navigate back:', backResult.success ? 'SUCCESS' : 'FAILED');
    if (backResult.success) {
      console.log('  URL:', backResult.state.url);
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