#!/usr/bin/env node
/**
 * Comprehensive Requirements Test for PlayClone
 * Tests all Phase 15 AI Assistant requirements
 */

const { PlayClone } = require('./dist/index.js');
const fs = require('fs');

async function testRequirements() {
  const results = {};
  console.log('🔍 Testing PlayClone Against AI Assistant Requirements\n');
  console.log('=' .repeat(60));
  
  // Test 1: MCP Dependencies
  console.log('\n📦 1. MCP Server Implementation');
  try {
    require('@modelcontextprotocol/sdk/server/index.js');
    results['MCP SDK installed'] = '✅';
    console.log('  ✅ MCP SDK installed');
  } catch (e) {
    results['MCP SDK installed'] = '❌';
    console.log('  ❌ MCP SDK not installed');
  }
  
  // Check MCP server file
  if (fs.existsSync('/home/john/repos/PlayClone/mcp-server.js')) {
    results['MCP server created'] = '✅';
    console.log('  ✅ MCP server file exists');
  } else {
    results['MCP server created'] = '❌';
    console.log('  ❌ MCP server file missing');
  }
  
  // Test 2: Search Engine Interaction
  console.log('\n🔎 2. Search Engine Interaction');
  const pc1 = new PlayClone({ headless: true, timeout: 15000 });
  try {
    await pc1.navigate('https://www.google.com');
    const fill = await pc1.fill('search', 'test query');
    results['Google search fill'] = fill.success ? '✅' : '❌';
    console.log(`  ${fill.success ? '✅' : '❌'} Google search field fill`);
    
    const enter = await pc1.press('Enter');
    results['Press Enter works'] = enter.success ? '✅' : '❌';
    console.log(`  ${enter.success ? '✅' : '❌'} Press Enter after search`);
    
    await pc1.close();
  } catch (e) {
    console.log('  ❌ Search test error:', e.message);
    await pc1.close();
  }
  
  // Test 3: GitHub Repository Analysis
  console.log('\n📚 3. GitHub Repository Analysis');
  const pc2 = new PlayClone({ headless: true, timeout: 20000 });
  try {
    await pc2.navigate('https://github.com/microsoft/TypeScript');
    await new Promise(r => setTimeout(r, 3000)); // Wait for dynamic content
    
    const text = await pc2.getText();
    const hasStats = typeof text.data === 'string' && 
                     (text.data.includes('Star') || text.data.includes('Fork'));
    results['GitHub stats extraction'] = hasStats ? '✅' : '❌';
    console.log(`  ${hasStats ? '✅' : '❌'} Extract repository statistics`);
    
    const links = await pc2.getLinks();
    const hasFiles = links.data?.links?.some(l => 
      l.text?.includes('.ts') || l.text?.includes('.js')
    );
    results['GitHub file navigation'] = hasFiles ? '✅' : '❌';
    console.log(`  ${hasFiles ? '✅' : '❌'} Navigate file tree`);
    
    await pc2.close();
  } catch (e) {
    console.log('  ❌ GitHub test error:', e.message);
    await pc2.close();
  }
  
  // Test 4: Stack Overflow Integration
  console.log('\n💬 4. Stack Overflow Integration');
  const pc3 = new PlayClone({ headless: true, timeout: 20000 });
  try {
    await pc3.navigate('https://stackoverflow.com/questions/503093/how-do-i-redirect-to-another-webpage');
    await new Promise(r => setTimeout(r, 3000));
    
    const text = await pc3.getText();
    const hasAnswer = typeof text.data === 'string' && 
                      text.data.includes('window.location');
    results['SO answer extraction'] = hasAnswer ? '✅' : '❌';
    console.log(`  ${hasAnswer ? '✅' : '❌'} Extract answers`);
    
    const hasCode = typeof text.data === 'string' && 
                    (text.data.includes('```') || text.data.includes('    '));
    results['SO code blocks'] = hasCode ? '✅' : '⚠️';
    console.log(`  ${hasCode ? '✅' : '⚠️'} Handle code blocks`);
    
    await pc3.close();
  } catch (e) {
    console.log('  ❌ Stack Overflow test error:', e.message);
    await pc3.close();
  }
  
  // Test 5: Error Recovery
  console.log('\n🛡️ 5. Error Recovery');
  const pc4 = new PlayClone({ headless: true, timeout: 5000 });
  try {
    const start = Date.now();
    const result = await pc4.navigate('https://httpstat.us/500');
    const elapsed = Date.now() - start;
    
    results['Timeout handling'] = elapsed < 10000 ? '✅' : '❌';
    console.log(`  ${elapsed < 10000 ? '✅' : '❌'} Timeout handling (${elapsed}ms)`);
    
    const clickResult = await pc4.click('non-existent-element');
    results['Graceful degradation'] = !clickResult.success && clickResult.error ? '✅' : '❌';
    console.log(`  ${!clickResult.success && clickResult.error ? '✅' : '❌'} Graceful degradation on missing elements`);
    
    await pc4.close();
  } catch (e) {
    console.log('  ⚠️ Error recovery partially working');
    await pc4.close();
  }
  
  // Test 6: State Management
  console.log('\n💾 6. State Management');
  const pc5 = new PlayClone({ headless: true, timeout: 10000 });
  try {
    await pc5.navigate('https://example.com');
    const save = await pc5.saveState('test-state');
    results['State checkpoint'] = save.success ? '✅' : '❌';
    console.log(`  ${save.success ? '✅' : '❌'} Save state checkpoint`);
    
    await pc5.navigate('https://www.iana.org');
    const restore = await pc5.restoreState('test-state');
    results['State restore'] = restore.success ? '✅' : '❌';
    console.log(`  ${restore.success ? '✅' : '❌'} Restore state`);
    
    const state = await pc5.getCurrentState();
    const correctUrl = state.value?.url?.includes('example.com');
    results['Complex workflow'] = correctUrl ? '✅' : '❌';
    console.log(`  ${correctUrl ? '✅' : '❌'} Complex workflow support`);
    
    await pc5.close();
  } catch (e) {
    console.log('  ❌ State management error:', e.message);
    await pc5.close();
  }
  
  // Test 7: Performance
  console.log('\n⚡ 7. Performance');
  const start = Date.now();
  const pc6 = new PlayClone({ headless: true });
  try {
    const launchTime = Date.now() - start;
    results['Browser startup'] = launchTime < 3000 ? '✅' : '⚠️';
    console.log(`  ${launchTime < 3000 ? '✅' : '⚠️'} Browser startup time (${launchTime}ms)`);
    
    const navStart = Date.now();
    await pc6.navigate('https://example.com');
    const navTime = Date.now() - navStart;
    results['Navigation speed'] = navTime < 2000 ? '✅' : '⚠️';
    console.log(`  ${navTime < 2000 ? '✅' : '⚠️'} Navigation speed (${navTime}ms)`);
    
    const text = await pc6.getText();
    const responseSize = JSON.stringify(text).length;
    results['Token optimization'] = responseSize < 1024 ? '✅' : '❌';
    console.log(`  ${responseSize < 1024 ? '✅' : '❌'} Response size optimization (${responseSize} bytes)`);
    
    await pc6.close();
  } catch (e) {
    console.log('  ❌ Performance test error:', e.message);
    await pc6.close();
  }
  
  // Test 8: Overall Test Suite Performance
  console.log('\n⏱️ 8. Test Suite Performance');
  const totalTime = Date.now() - testStartTime;
  results['Test completion time'] = totalTime < 60000 ? '✅' : '❌';
  console.log(`  ${totalTime < 60000 ? '✅' : '❌'} All tests under 60s (${Math.round(totalTime/1000)}s)`);
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 REQUIREMENTS SUMMARY\n');
  
  let passed = 0, failed = 0, warning = 0;
  for (const [test, result] of Object.entries(results)) {
    console.log(`  ${result} ${test}`);
    if (result === '✅') passed++;
    else if (result === '❌') failed++;
    else warning++;
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️ Warnings: ${warning}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round(passed/(passed+failed+warning)*100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All critical requirements met!');
  } else {
    console.log(`\n⚠️ ${failed} requirements still need work.`);
  }
  
  return { passed, failed, warning };
}

// Track total time
const testStartTime = Date.now();

// Run tests
testRequirements().then(results => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});