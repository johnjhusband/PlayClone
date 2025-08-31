import { PlayClone } from './dist/index';

async function testBackNavigation() {
    const pc = new PlayClone({ headless: false }); // Use visible browser
    
    try {
        console.log('1. Navigating to example.com...');
        const nav1 = await pc.navigate('https://example.com');
        console.log('   Result:', nav1.success, nav1.value?.url);
        
        console.log('2. Extracting text from example.com...');
        const text1 = await pc.getText();
        console.log('   Text found:', text1.data ? text1.data.substring(0, 50) + '...' : 'null');
        
        console.log('3. Clicking "More information" link...');
        const click = await pc.click('More information');
        console.log('   Click result:', click.success);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('4. Getting current state...');
        const state = await pc.getCurrentState();
        console.log('   Current URL:', state.value?.url);
        
        console.log('5. Going back to example.com...');
        const back = await pc.back();
        console.log('   Back result:', back.success, back.value?.url);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('6. Getting current state after back...');
        const state2 = await pc.getCurrentState();
        console.log('   Current URL:', state2.value?.url);
        
        console.log('7. Extracting text after back navigation...');
        const text2 = await pc.getText();
        console.log('   Text found:', text2.data ? text2.data.substring(0, 50) + '...' : 'null');
        
        if (!text2.data) {
            console.log('   Full result:', JSON.stringify(text2, null, 2));
        }
        
        console.log('\nWaiting 5 seconds to see browser state...');
        await new Promise(resolve => setTimeout(resolve, 5000));
    } finally {
        await pc.close();
    }
}

testBackNavigation().catch(console.error);
