#!/usr/bin/env node

/**
 * Simple test for GPT-4 Vision Simulation Mode
 */

const { PlayClone } = require('../dist/index');

async function testVisionSimulation() {
  console.log('🧪 Testing GPT-4 Vision Simulation Mode\n');
  
  const pc = new PlayClone({ headless: true });
  
  try {
    // Navigate to example.com
    console.log('1. Navigating to example.com...');
    await pc.navigate('https://example.com');
    
    // Initialize vision without API key
    console.log('2. Initializing vision (simulation mode)...');
    const initResult = await pc.initializeVision();
    console.log('   Result:', initResult.success ? '✅ Success' : '❌ Failed');
    if (initResult.value) {
      console.log('   Mode:', initResult.value.mode);
    }
    if (initResult.error) {
      console.log('   Error:', initResult.error);
    }
    
    // Analyze page
    console.log('\n3. Analyzing page elements...');
    const analysisResult = await pc.analyzeWithVision();
    console.log('   Result:', analysisResult.success ? '✅ Success' : '❌ Failed');
    
    if (analysisResult.success && analysisResult.value) {
      const data = analysisResult.value;
      console.log('   Elements found:', data.elements?.length || 0);
      console.log('   Description:', data.description);
    }
    
    // Generate test script
    console.log('\n4. Generating test script...');
    const testResult = await pc.generateTestFromVision();
    console.log('   Result:', testResult.success ? '✅ Success' : '❌ Failed');
    
    if (testResult.success && testResult.value) {
      const lines = testResult.value.split('\n').slice(0, 5);
      console.log('   Preview:');
      lines.forEach(line => console.log('     ', line));
    }
    
    console.log('\n✨ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc.close();
  }
}

testVisionSimulation().catch(console.error);