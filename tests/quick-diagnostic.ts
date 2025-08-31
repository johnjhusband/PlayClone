#!/usr/bin/env ts-node

/**
 * Quick diagnostic test to identify AI assistant integration issues
 */

import { PlayClone } from '../dist/index.js';

async function quickDiagnostic() {
    console.log('🔍 PlayClone Quick Diagnostic Test');
    console.log('=' .repeat(50));
    
    const pc = new PlayClone({ 
        headless: true, 
        timeout: 5000 
    });
    
    console.log('\n1. Testing basic navigation...');
    try {
        const start = Date.now();
        const result = await pc.navigate('https://example.com');
        const duration = Date.now() - start;
        
        if (result.success) {
            console.log(`   ✅ Navigation successful (${duration}ms)`);
            console.log(`   📊 Response size: ${JSON.stringify(result).length} bytes`);
        } else {
            console.log(`   ❌ Navigation failed: ${result.error}`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error}`);
    }
    
    console.log('\n2. Testing text extraction...');
    try {
        const textResult = await pc.getText();
        if (textResult.data) {
            const text = typeof textResult.data === 'string' 
                ? textResult.data 
                : (textResult.data.text || JSON.stringify(textResult.data));
            console.log(`   ✅ Text extracted: "${text.substring(0, 50)}..."`);
            console.log(`   📊 Response size: ${JSON.stringify(textResult).length} bytes`);
        } else {
            console.log(`   ❌ No text data extracted`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error}`);
    }
    
    console.log('\n3. Testing search engine (DuckDuckGo)...');
    try {
        const navResult = await pc.navigate('https://duckduckgo.com');
        if (!navResult.success) {
            console.log(`   ❌ Failed to navigate: ${navResult.error}`);
        } else {
            console.log(`   ✅ Navigated to DuckDuckGo`);
            
            // Try to fill search
            const fillResult = await pc.fill('search', 'test query');
            if (fillResult.success) {
                console.log(`   ✅ Search field filled`);
            } else {
                console.log(`   ❌ Failed to fill search: ${fillResult.error}`);
                
                // Try alternative selector
                const altFill = await pc.fill('q', 'test query');
                if (altFill.success) {
                    console.log(`   ✅ Search field filled (alt selector)`);
                } else {
                    console.log(`   ❌ Alt selector also failed: ${altFill.error}`);
                }
            }
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error}`);
    }
    
    console.log('\n4. Testing natural language click...');
    try {
        await pc.navigate('https://example.com');
        const clickResult = await pc.click('More information');
        if (clickResult.success) {
            console.log(`   ✅ Click successful`);
        } else {
            console.log(`   ❌ Click failed: ${clickResult.error}`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error}`);
    }
    
    await pc.close();
    console.log('\n✅ Diagnostic complete');
}

quickDiagnostic().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});