const { TestScenarioGenerator } = require('../dist/devtools/TestScenarioGenerator');
const { PlayClone } = require('../dist/index');

async function demonstrateTestGenerator() {
  console.log('🧪 PlayClone Test Scenario Generator Demo\n');
  
  const generator = new TestScenarioGenerator();
  
  // 1. List available templates
  console.log('📋 Available Templates:');
  const templates = generator.listTemplates();
  templates.forEach(t => console.log(`   - ${t}`));
  console.log();
  
  // 2. Generate a test from template
  console.log('🔨 Generating E-commerce Test from Template...\n');
  
  const ecommerceTest = await generator.generateFromTemplate('ecommerce-checkout', {
    baseUrl: 'https://example-shop.com',
    searchQuery: 'laptop',
    email: 'test@example.com',
    address: '123 Test Street'
  });
  
  console.log('Generated Test Scenario:');
  console.log(JSON.stringify(ecommerceTest, null, 2).substring(0, 500) + '...\n');
  
  // 3. Generate code in different formats
  console.log('📝 Generating Code in Different Formats:\n');
  
  // JavaScript for PlayClone
  const jsCode = await generator.generateCode(ecommerceTest, {
    outputFormat: 'javascript',
    framework: 'playclone',
    includeComments: true,
    includeTryCatch: true,
    includeLogging: true
  });
  
  console.log('JavaScript (PlayClone):');
  console.log('```javascript');
  console.log(jsCode.substring(0, 800));
  console.log('...\n```\n');
  
  // Playwright version
  const playwrightCode = await generator.generateCode(ecommerceTest, {
    outputFormat: 'javascript',
    framework: 'playwright',
    includeComments: false
  });
  
  console.log('JavaScript (Playwright):');
  console.log('```javascript');
  console.log(playwrightCode.substring(0, 500));
  console.log('...\n```\n');
  
  // YAML format
  const yamlCode = await generator.generateCode(ecommerceTest, {
    outputFormat: 'yaml'
  });
  
  console.log('YAML Format:');
  console.log('```yaml');
  console.log(yamlCode.substring(0, 400));
  console.log('...\n```\n');
  
  // 4. Create custom scenario
  console.log('🎯 Creating Custom Test Scenario...\n');
  
  const customScenario = await generator.createScenario('GitHub Search Test', {
    description: 'Test GitHub repository search functionality',
    url: 'https://github.com',
    steps: [
      { action: 'navigate', value: 'https://github.com', description: 'Go to GitHub' },
      { action: 'click', target: 'search button', description: 'Open search' },
      { action: 'fill', target: 'search input', value: 'playclone', description: 'Search for playclone' },
      { action: 'press', value: 'Enter', description: 'Submit search' },
      { action: 'wait', value: '2000', description: 'Wait for results' },
      { action: 'click', target: 'first repository', description: 'Click first result' },
      { action: 'getText', target: 'repository description', description: 'Get repo description' }
    ],
    assertions: [
      { type: 'url', expected: '/search', description: 'On search results page' },
      { type: 'exists', target: 'search results', expected: true, description: 'Results exist' },
      { type: 'contains', target: 'repository name', expected: 'playclone', description: 'Found playclone' }
    ],
    metadata: {
      tags: ['github', 'search', 'integration'],
      priority: 'medium',
      browserType: 'chromium',
      timeout: 15000
    }
  });
  
  console.log('Custom Scenario Created:', customScenario.name);
  console.log('Steps:', customScenario.steps.length);
  console.log('Assertions:', customScenario.assertions.length);
  console.log();
  
  // 5. Analyze scenario
  console.log('📊 Analyzing Test Scenario...\n');
  
  const analysis = generator.analyzeScenario(customScenario);
  console.log('Analysis Results:');
  console.log(`  Complexity: ${analysis.complexity}`);
  console.log(`  Estimated Duration: ${analysis.estimatedDuration}ms`);
  console.log(`  Coverage: ${analysis.coverage.join(', ')}`);
  console.log(`  Risks: ${analysis.risks.length > 0 ? analysis.risks.join('; ') : 'None identified'}`);
  console.log(`  Suggestions:`);
  analysis.suggestions.forEach(s => console.log(`    - ${s}`));
  console.log();
  
  // 6. Generate batch tests
  console.log('🚀 Batch Generating Multiple Tests...\n');
  
  const scenarios = ['login-flow', 'search-test', 'navigation-test'];
  const batchResults = await generator.batchGenerate(scenarios, {
    outputFormat: 'javascript',
    framework: 'playclone',
    includeComments: false,
    outputPath: null
  });
  
  console.log(`Generated ${batchResults.size} test files:`);
  for (const [name, code] of batchResults) {
    console.log(`  ✓ ${name} (${code.length} bytes)`);
  }
  console.log();
  
  // 7. Demonstrate live recording (simulated)
  console.log('🎬 Recording User Actions (Simulated)...\n');
  
  const pc = new PlayClone({ headless: true });
  await pc.launch();
  
  // Simulate recording
  console.log('Starting recording...');
  await generator.startRecording(pc);
  
  // Simulate some actions
  await pc.navigate('https://example.com');
  await pc.click('More information...');
  
  // Stop recording
  const recordedScenario = await generator.stopRecording();
  console.log('Recording stopped.');
  console.log(`Recorded ${recordedScenario.steps.length} steps\n`);
  
  await pc.close();
  
  // 8. Save and load scenarios
  console.log('💾 Saving and Loading Scenarios...\n');
  
  const savePath = './test-scenario.json';
  await generator.saveScenario('GitHub Search Test', savePath);
  console.log(`Saved scenario to ${savePath}`);
  
  const loadedScenario = await generator.loadScenario(savePath);
  console.log(`Loaded scenario: ${loadedScenario.name}`);
  console.log();
  
  // 9. Generate test for different frameworks
  console.log('🔄 Cross-Framework Code Generation:\n');
  
  const frameworks = ['playclone', 'playwright', 'puppeteer'];
  for (const fw of frameworks) {
    const code = await generator.generateCode(customScenario, {
      outputFormat: 'javascript',
      framework: fw,
      includeComments: false,
      includeTryCatch: false
    });
    console.log(`${fw} version: ${code.split('\n').length} lines`);
  }
  
  console.log('\n✅ Test Scenario Generator Demo Complete!');
  console.log('\n📚 Features Demonstrated:');
  console.log('  • Template-based test generation');
  console.log('  • Custom scenario creation');
  console.log('  • Multi-format code generation');
  console.log('  • Cross-framework support');
  console.log('  • Test analysis and recommendations');
  console.log('  • Batch generation');
  console.log('  • Scenario persistence');
  console.log('  • Live recording capabilities');
  
  // Cleanup
  const fs = require('fs');
  if (fs.existsSync(savePath)) {
    fs.unlinkSync(savePath);
  }
}

// Run the demo
demonstrateTestGenerator().catch(console.error);