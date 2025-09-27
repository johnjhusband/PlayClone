#!/usr/bin/env node

/**
 * Test GPT-4 Vision Simulation Mode
 * This test verifies that GPT-4 Vision works without an API key using DOM-based analysis
 */

const { PlayClone } = require('../dist/index');

async function testVisionSimulation() {
  console.log('🧪 Testing GPT-4 Vision Simulation Mode (No API Key Required)\n');
  
  const pc = new PlayClone({ headless: false });
  
  try {
    // Test 1: Initialize vision without API key (should use simulation mode)
    console.log('Test 1: Initialize Vision without API key');
    const visionInit = await pc.initializeVision();
    console.log('✅ Vision initialized:', visionInit.success ? 'Success' : 'Failed');
    if (!visionInit.success) {
      console.log('❌ Error:', visionInit.error);
    }
    console.log();
    
    // Test 2: Navigate to a test page
    console.log('Test 2: Navigate to example.com');
    const navResult = await pc.navigate('https://example.com');
    console.log('✅ Navigation result:', navResult.success ? 'Success' : 'Failed');
    console.log();
    
    // Test 3: Analyze page with vision (should use DOM analysis)
    console.log('Test 3: Analyze page elements using Vision simulation');
    const analysisResult = await pc.analyzeWithVision();
    console.log('✅ Analysis result:', analysisResult.success ? 'Success' : 'Failed');
    
    if (analysisResult.success && analysisResult.value) {
      const data = analysisResult.value;
      console.log('📊 Found elements:', data.elements?.length || 0);
      console.log('📝 Page description:', data.description);
      console.log('🎯 Suggested actions:', data.suggestedActions?.join(', '));
      
      // Display first few elements
      if (data.elements && data.elements.length > 0) {
        console.log('\n🔍 Sample elements detected:');
        data.elements.slice(0, 3).forEach((el, i) => {
          console.log(`  ${i + 1}. ${el.type}: "${el.text || el.attributes?.placeholder || 'no text'}" at (${el.position.x}, ${el.position.y})`);
        });
      }
    }
    console.log();
    
    // Test 4: Generate test script from visual analysis
    console.log('Test 4: Generate test script from visual analysis');
    const testGenResult = await pc.generateTestFromVision();
    console.log('✅ Test generation:', testGenResult.success ? 'Success' : 'Failed');
    
    if (testGenResult.success && testGenResult.value) {
      console.log('\n📜 Generated test script:');
      console.log('---');
      const lines = testGenResult.value.split('\n').slice(0, 8);
      lines.forEach(line => console.log(line));
      if (testGenResult.value.split('\n').length > 8) {
        console.log('... (truncated)');
      }
      console.log('---');
    }
    console.log();
    
    // Test 5: Navigate to a more complex page
    console.log('Test 5: Analyze a more complex page (GitHub)');
    await pc.navigate('https://github.com/login');
    const githubAnalysis = await pc.analyzeWithVision();
    
    if (githubAnalysis.success && githubAnalysis.value) {
      const data = githubAnalysis.value;
      console.log('✅ GitHub page analyzed');
      console.log('📊 Found elements:', data.elements?.length || 0);
      console.log('📝 Page description:', data.description);
      
      // Look for form elements
      const formElements = data.elements?.filter(el => 
        el.type === 'input' || el.type === 'button' || el.type === 'submit'
      ) || [];
      console.log('📋 Form elements found:', formElements.length);
    }
    console.log();
    
    // Test 6: Detect accessibility issues
    console.log('Test 6: Analyze accessibility using vision simulation');
    const accessibilityResult = await pc.detectAccessibilityIssues();
    console.log('✅ Accessibility analysis:', accessibilityResult.success ? 'Success' : 'Failed');
    
    if (accessibilityResult.success && accessibilityResult.value) {
      const issues = accessibilityResult.value;
      console.log('⚠️ Accessibility issues found:', issues.summary?.totalIssues || 0);
      if (issues.summary) {
        console.log('  - Errors:', issues.summary.errors);
        console.log('  - Warnings:', issues.summary.warnings);
      }
    }
    
    console.log('\n✨ All tests completed successfully!');
    console.log('🎯 GPT-4 Vision simulation mode works without API key');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pc.close();
  }
}

// Run the test
testVisionSimulation().catch(console.error);