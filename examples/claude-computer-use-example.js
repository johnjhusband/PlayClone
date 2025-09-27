const { PlayClone } = require('../dist/index');

/**
 * Example demonstrating Claude Computer Use API integration
 * This shows how to use visual element detection and screen interaction
 */
async function runClaudeComputerUseExample() {
  console.log('🤖 Claude Computer Use Integration Example\n');
  console.log('This example demonstrates visual element detection and direct screen interaction\n');
  
  let pc = null;
  
  try {
    // Initialize PlayClone with visible browser
    pc = new PlayClone({ 
      headless: false,
      viewport: { width: 1280, height: 720 }
    });
    
    // Navigate to a test page
    console.log('📍 Navigating to example.com...');
    const navResult = await pc.navigate('https://example.com');
    if (navResult.success) {
      console.log('✅ Navigation successful\n');
    }
    
    // 1. Capture screen for analysis
    console.log('📸 Capturing screen for visual analysis...');
    const screenResult = await pc.captureScreenForAnalysis();
    if (screenResult.success) {
      console.log(`✅ Screen captured: ${screenResult.value.size} bytes\n`);
    }
    
    // 2. Detect visual elements on the page
    console.log('🔍 Detecting visual elements...');
    const elementsResult = await pc.detectVisualElementsWithClaude();
    if (elementsResult.success) {
      const data = JSON.parse(elementsResult.value);
      console.log(`✅ Found ${data.count} visual elements`);
      console.log(`   Element types: ${data.types.join(', ')}`);
      
      if (data.elements && data.elements.length > 0) {
        console.log('\n   First few elements:');
        data.elements.slice(0, 3).forEach(el => {
          console.log(`   - ${el.type}: "${el.text || 'no text'}" at (${el.bounds.x}, ${el.bounds.y})`);
        });
      }
      console.log();
    }
    
    // 3. Find element by visual description
    console.log('🎯 Finding element by visual description...');
    const findResult = await pc.findByVisualDescriptionWithClaude('Example Domain');
    if (findResult.success) {
      const data = JSON.parse(findResult.value);
      if (data.found) {
        console.log(`✅ Found element: ${data.element.type}`);
        console.log(`   Text: "${data.element.text}"`);
        console.log(`   Position: (${data.element.bounds.x}, ${data.element.bounds.y})`);
        console.log(`   Confidence: ${data.element.confidence}\n`);
      } else {
        console.log('⚠️ Element not found by description\n');
      }
    }
    
    // 4. Direct screen interaction - Click
    console.log('👆 Performing direct screen click...');
    const clickResult = await pc.interactWithScreen({
      type: 'click',
      coordinates: { x: 640, y: 360 } // Center of viewport
    });
    if (clickResult.success) {
      console.log(`✅ ${clickResult.value}\n`);
    }
    
    // 5. Type text directly
    console.log('⌨️ Typing text...');
    const typeResult = await pc.interactWithScreen({
      type: 'type',
      text: 'Hello from Claude Computer Use!'
    });
    if (typeResult.success) {
      console.log(`✅ ${typeResult.value}\n`);
    }
    
    // 6. Scroll the page
    console.log('📜 Scrolling the page...');
    const scrollResult = await pc.interactWithScreen({
      type: 'scroll',
      direction: 'down',
      distance: 200
    });
    if (scrollResult.success) {
      console.log(`✅ ${scrollResult.value}\n`);
    }
    
    // 7. Understand the UI
    console.log('🧠 Understanding the UI structure...');
    const uiResult = await pc.understandUI();
    if (uiResult.success) {
      const understanding = JSON.parse(uiResult.value);
      console.log('✅ UI Analysis:');
      console.log(`   Total elements: ${understanding.totalElements}`);
      console.log(`   Interactive elements: ${understanding.interactiveCount}`);
      console.log(`   Text elements: ${understanding.textCount}`);
      console.log(`   Page layout: ${understanding.pageStructure.layout}\n`);
    }
    
    // 8. Execute a visual flow
    console.log('🔄 Executing visual automation flow...');
    const flowResult = await pc.executeVisualFlow([
      { action: 'wait', value: '500' },
      { action: 'scroll', direction: 'up' },
      { action: 'wait', value: '500' },
      { action: 'click', target: 'link' }
    ]);
    if (flowResult.success || flowResult.value) {
      const flow = JSON.parse(flowResult.value);
      console.log(`✅ Flow execution: ${flow.successfulSteps}/${flow.totalSteps} steps succeeded`);
      flow.results.forEach(step => {
        const status = step.success ? '✓' : '✗';
        const error = step.error ? ` (${step.error})` : '';
        console.log(`   ${status} ${step.action}${error}`);
      });
      console.log();
    }
    
    // 9. Hybrid element selection
    console.log('🔀 Testing hybrid element selection...');
    const hybridResult = await pc.selectElementHybrid('a', 'more information link');
    if (hybridResult.success) {
      const data = JSON.parse(hybridResult.value);
      console.log(`✅ Hybrid selection: ${data.found ? 'Element found' : 'Element not found'}\n`);
    }
    
    // 10. Get visual debug information
    console.log('🐛 Getting visual debug information...');
    const debugResult = await pc.getVisualDebugInfo();
    if (debugResult.success) {
      const debug = JSON.parse(debugResult.value);
      console.log('✅ Debug Information:');
      console.log(`   Screen buffer size: ${debug.screenSize} bytes`);
      console.log(`   Detected elements: ${debug.detectedElements}`);
      console.log(`   High confidence elements: ${debug.highConfidenceElements}`);
      if (debug.lastInteraction) {
        console.log(`   Last interaction: ${debug.lastInteraction.type}`);
      }
      console.log();
    }
    
    // Navigate to a more complex page
    console.log('📍 Navigating to GitHub for complex page testing...');
    await pc.navigate('https://github.com');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page load
    
    // Test on complex page
    console.log('🔍 Detecting elements on complex page...');
    const complexResult = await pc.detectVisualElementsWithClaude();
    if (complexResult.success) {
      const data = JSON.parse(complexResult.value);
      console.log(`✅ Found ${data.count} elements on GitHub`);
      console.log(`   Element types: ${data.types.join(', ')}\n`);
    }
    
    console.log('🎉 Claude Computer Use integration example completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (pc) {
      console.log('\n🔚 Closing browser...');
      await pc.close();
    }
  }
}

// Run the example
console.log('Starting Claude Computer Use example...\n');
runClaudeComputerUseExample().catch(console.error);