import { PlayClone } from './dist/index';

async function debugTextExtraction() {
    const pc = new PlayClone({ headless: true });
    
    try {
        console.log('Navigating to example.com...');
        await pc.navigate('https://example.com');
        
        console.log('Extracting text...');
        const textResult = await pc.getText();
        
        console.log('Full result:', JSON.stringify(textResult, null, 2));
        console.log('Data type:', typeof textResult.data);
        console.log('Data value:', textResult.data);
        
        if (textResult.data && typeof textResult.data === 'object') {
            console.log('Data keys:', Object.keys(textResult.data));
            console.log('Text property:', (textResult.data as any).text);
        }
    } finally {
        await pc.close();
    }
}

debugTextExtraction().catch(console.error);
