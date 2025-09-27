const { PlayClone } = require('./dist/index.js');

async function testGetText() {
    const pc = new PlayClone({ headless: true });
    
    try {
        // Navigate to example.com
        await pc.navigate('https://example.com');
        
        // Try getText without selector
        const result = await pc.getText();
        console.log('getText result:', JSON.stringify(result, null, 2));
        
        // Check the structure
        console.log('result.type:', result.type);
        console.log('result.data:', result.data);
        console.log('result.data.text:', result.data?.text);
        console.log('typeof result.data.text:', typeof result.data?.text);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pc.close();
    }
}

testGetText();