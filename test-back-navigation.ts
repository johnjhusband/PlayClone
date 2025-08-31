import { PlayClone } from './dist/index';

async function testBackNavigation() {
    const pc = new PlayClone({ headless: false });
    
    try {
        // Navigate to example.com
        console.log('1. Navigating to example.com...');
        await pc.navigate('https://example.com');
        
        // Click "More information" link
        console.log('2. Clicking "More information"...');
        await pc.click('More information');
        
        // Wait for navigation to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Go back
        console.log('3. Going back...');
        const backResult = await pc.back();
        console.log('Back result:', backResult);
        
        // Wait a bit
        console.log('4. Waiting 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now get text
        console.log('5. Getting text from page...');
        const textResult = await pc.getText();
        console.log('Text found:', textResult.data?.text?.substring(0, 100));
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Keep browser open to see state
        console.log('Press Ctrl+C to close browser...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        await pc.close();
    }
}

testBackNavigation();