const { PlayClone, GPT4VisionIntegration, VisualDebugger, VisualRegressionTester } = require('../dist');

async function demonstrateVisionIntegration() {
  console.log('🚀 PlayClone GPT-4 Vision Integration Demo\n');
  
  // Initialize PlayClone
  const pc = new PlayClone({ headless: false });
  
  try {
    // Initialize GPT-4 Vision (API key would be required in production)
    const vision = new GPT4VisionIntegration({
      apiKey: process.env.OPENAI_API_KEY || 'demo-key',
      model: 'gpt-4-vision-preview',
      maxTokens: 500
    });
    
    // Initialize Visual Debugger
    const debugger = new VisualDebugger({
      outputDir: './debug-output',
      captureOnError: true,
      annotateElements: true,
      showConfidence: true
    });
    
    // Initialize Visual Regression Tester
    const regressionTester = new VisualRegressionTester({
      baselineDir: './baselines',
      outputDir: './visual-regression-output',
      threshold: 95,
      viewports: [
        { width: 1920, height: 1080, name: 'desktop' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' }
      ]
    });
    
    // Navigate to a test page
    console.log('📍 Navigating to example.com...');
    await pc.navigate('https://example.com');
    
    // Get the internal page object for vision integration
    const page = pc.page;
    
    // Attach vision tools to the page
    await vision.attachToPage(page);
    await debugger.attachToPage(page, vision);
    await regressionTester.attachToPage(page, vision);
    
    console.log('\n🔍 1. Analyzing page with GPT-4 Vision...');
    const analysis = await vision.analyzeScreenshot();
    if (analysis.success && analysis.data) {
      console.log('   ✅ Page Analysis:');
      console.log(`      - Description: ${analysis.data.description}`);
      console.log(`      - Layout: ${analysis.data.layout}`);
      console.log(`      - Elements found: ${analysis.data.elements.length}`);
      console.log(`      - Suggested actions: ${analysis.data.suggestedActions.join(', ')}`);
      
      // Display detected elements
      if (analysis.data.elements.length > 0) {
        console.log('\n   📋 Detected Elements:');
        analysis.data.elements.forEach((el, i) => {
          console.log(`      ${i + 1}. ${el.type}: "${el.text || 'No text'}" (${Math.round(el.confidence * 100)}% confidence)`);
        });
      }
    }
    
    console.log('\n🎯 2. Finding element by visual description...');
    const elementResult = await vision.findElementByDescription('main heading or title');
    if (elementResult.success && elementResult.data) {
      console.log(`   ✅ Found element: ${elementResult.data.type}`);
      console.log(`      - Text: "${elementResult.data.text}"`);
      console.log(`      - Position: (${elementResult.data.position.x}, ${elementResult.data.position.y})`);
      console.log(`      - Size: ${elementResult.data.position.width}x${elementResult.data.position.height}`);
    }
    
    console.log('\n🐛 3. Starting visual debugging...');
    await debugger.startRecording();
    
    // Capture a snapshot with annotations
    const snapshot = await debugger.captureSnapshot('Initial page load');
    if (snapshot.success) {
      console.log(`   ✅ Debug snapshot captured`);
      console.log(`      - URL: ${snapshot.data.url}`);
      console.log(`      - Elements: ${snapshot.data.elements.length}`);
      console.log(`      - Timestamp: ${new Date(snapshot.data.timestamp).toLocaleTimeString()}`);
    }
    
    // Highlight an element
    console.log('\n   🔦 Highlighting the main heading...');
    await debugger.highlightElement('h1', 'blue');
    
    // Stop recording and generate report
    const reportResult = await debugger.stopRecording();
    if (reportResult.success) {
      console.log(`   ✅ Debug report saved: ${reportResult.data}`);
    }
    
    console.log('\n📸 4. Visual Regression Testing...');
    
    // Capture baseline (first run)
    console.log('   📷 Capturing baseline screenshots...');
    const baselineResult = await regressionTester.captureBaseline('example-homepage');
    if (baselineResult.success) {
      console.log(`   ✅ Baselines captured: ${baselineResult.data}`);
    }
    
    // Compare with baseline
    console.log('   🔍 Comparing current page with baseline...');
    const comparisonResult = await regressionTester.compareWithBaseline('example-homepage');
    if (comparisonResult.success && comparisonResult.data) {
      console.log(`   ${comparisonResult.data.passed ? '✅' : '❌'} Test ${comparisonResult.data.passed ? 'PASSED' : 'FAILED'}`);
      console.log(`      - Similarity: ${comparisonResult.data.similarity}%`);
      console.log(`      - Threshold: 95%`);
      if (comparisonResult.data.differences.length > 0) {
        console.log(`      - Differences: ${comparisonResult.data.differences.join(', ')}`);
      }
    }
    
    console.log('\n🤖 5. Generating test from visual analysis...');
    const testResult = await vision.generateTestFromVisual();
    if (testResult.success && testResult.data) {
      console.log('   ✅ Generated Test Script:');
      console.log(testResult.data.split('\n').map(line => '      ' + line).join('\n'));
    }
    
    console.log('\n♿ 6. Checking accessibility issues...');
    const accessibilityResult = await vision.detectAccessibilityIssues();
    if (accessibilityResult.success && accessibilityResult.data) {
      console.log(`   ⚠️ Found ${accessibilityResult.data.length} accessibility issues:`);
      accessibilityResult.data.forEach((issue, i) => {
        console.log(`      ${i + 1}. ${issue}`);
      });
    }
    
    console.log('\n🎨 7. Running visual regression test suite...');
    const testSuite = [
      { name: 'homepage', url: 'https://example.com' },
      { name: 'about', url: 'https://example.com', selector: 'body' }
    ];
    
    const suiteResult = await regressionTester.runTestSuite(testSuite);
    if (suiteResult.success && suiteResult.data) {
      console.log(`   📊 Test Suite Results:`);
      console.log(`      - Total tests: ${suiteResult.data.totalTests}`);
      console.log(`      - Passed: ${suiteResult.data.passed}`);
      console.log(`      - Failed: ${suiteResult.data.failed}`);
      console.log(`      - Summary: ${suiteResult.data.summary}`);
    }
    
    console.log('\n✨ Demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc.close();
  }
}

// Run the demo
demonstrateVisionIntegration().catch(console.error);