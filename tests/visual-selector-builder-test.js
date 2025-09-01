#!/usr/bin/env node

/**
 * Test script for Visual Selector Builder
 */

const { VisualSelectorBuilder } = require('../dist/devtools/VisualSelectorBuilder');
const { PlayClone } = require('../dist');

async function runTests() {
  console.log('🧪 Testing Visual Selector Builder...\n');
  
  let builder;
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Create builder instance
    console.log('Test 1: Creating Visual Selector Builder instance...');
    builder = new VisualSelectorBuilder({
      port: 8766,  // Different port to avoid conflicts
      host: 'localhost',
      autoOpen: false  // Don't auto-open browser for tests
    });
    console.log('✅ Builder instance created successfully\n');
    testsPassed++;

    // Test 2: Start the server
    console.log('Test 2: Starting builder server...');
    await builder.start();
    console.log('✅ Server started on port 8766\n');
    testsPassed++;

    // Test 3: Test HTTP endpoint
    console.log('Test 3: Testing HTTP endpoint...');
    const response = await fetch('http://localhost:8766/');
    if (response.ok) {
      const html = await response.text();
      if (html.includes('PlayClone Visual Selector Builder')) {
        console.log('✅ HTTP endpoint serving UI correctly\n');
        testsPassed++;
      } else {
        console.log('❌ UI HTML not correct\n');
        testsFailed++;
      }
    } else {
      console.log('❌ HTTP endpoint not responding\n');
      testsFailed++;
    }

    // Test 4: Test API connect endpoint
    console.log('Test 4: Testing connect API endpoint...');
    const connectResponse = await fetch('http://localhost:8766/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    
    const connectResult = await connectResponse.json();
    if (connectResult.success) {
      console.log('✅ Successfully connected to example.com\n');
      testsPassed++;
    } else {
      console.log('❌ Failed to connect:', connectResult.error, '\n');
      testsFailed++;
    }

    // Test 5: Test selector testing endpoint
    console.log('Test 5: Testing selector test API...');
    const testResponse = await fetch('http://localhost:8766/api/test-selector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        selector: 'More information...', 
        type: 'natural' 
      })
    });
    
    const testResult = await testResponse.json();
    if (testResult.success && testResult.found > 0) {
      console.log(`✅ Found ${testResult.found} element(s) with natural language selector\n`);
      testsPassed++;
    } else {
      console.log('❌ Natural language selector test failed\n');
      testsFailed++;
    }

    // Test 6: Test CSS selector
    console.log('Test 6: Testing CSS selector...');
    const cssResponse = await fetch('http://localhost:8766/api/test-selector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        selector: 'h1', 
        type: 'css' 
      })
    });
    
    const cssResult = await cssResponse.json();
    if (cssResult.success && cssResult.found > 0) {
      console.log(`✅ Found ${cssResult.found} h1 element(s) with CSS selector\n`);
      testsPassed++;
    } else {
      console.log('❌ CSS selector test failed\n');
      testsFailed++;
    }

    // Test 7: Test code generation
    console.log('Test 7: Testing code generation...');
    const codeResponse = await fetch('http://localhost:8766/api/generate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectors: [
          { selector: 'h1', type: 'css' },
          { selector: 'More information link', type: 'natural' }
        ],
        language: 'javascript'
      })
    });
    
    const codeResult = await codeResponse.json();
    if (codeResult.success && codeResult.code.includes('PlayClone')) {
      console.log('✅ Code generation successful\n');
      testsPassed++;
    } else {
      console.log('❌ Code generation failed\n');
      testsFailed++;
    }

    // Test 8: Test highlight functionality
    console.log('Test 8: Testing element highlighting...');
    const highlightResponse = await fetch('http://localhost:8766/api/highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selector: 'h1',
        type: 'css'
      })
    });
    
    const highlightResult = await highlightResponse.json();
    if (highlightResult.success) {
      console.log('✅ Element highlighting successful\n');
      testsPassed++;
    } else {
      console.log('❌ Element highlighting failed\n');
      testsFailed++;
    }

    // Test 9: Test page inspection
    console.log('Test 9: Testing page inspection...');
    const inspectResponse = await fetch('http://localhost:8766/api/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const inspectResult = await inspectResponse.json();
    if (inspectResult.success && inspectResult.elements.length > 0) {
      console.log(`✅ Page inspection found ${inspectResult.elements.length} elements\n`);
      testsPassed++;
    } else {
      console.log('❌ Page inspection failed\n');
      testsFailed++;
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    testsFailed++;
  } finally {
    // Clean up
    if (builder) {
      console.log('\n🧹 Cleaning up...');
      await builder.stop();
      console.log('✅ Builder stopped\n');
    }

    // Report results
    console.log('📊 Test Results:');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
    
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

// Run tests
runTests().catch(console.error);