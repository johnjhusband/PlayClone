#!/usr/bin/env node

const { PlayClone } = require('../dist/index');

async function testSelfHealingSelectors() {
  console.log('🔧 Testing Self-Healing Selectors...\n');
  
  const pc = new PlayClone({ headless: false });
  let passCount = 0;
  let totalTests = 0;

  try {
    // Test 1: Navigate to a test page
    totalTests++;
    console.log('Test 1: Navigate to example.com');
    const navResult = await pc.navigate('https://example.com');
    if (navResult.success) {
      console.log('✅ Navigation successful');
      passCount++;
    } else {
      console.log('❌ Navigation failed');
    }

    // Test 2: Find element with original selector
    totalTests++;
    console.log('\nTest 2: Find element with standard selector');
    const findResult = await pc.findWithHealing('h1');
    if (findResult.success && findResult.data.found) {
      console.log(`✅ Element found with strategy: ${findResult.data.strategy}`);
      passCount++;
    } else {
      console.log('❌ Element not found');
    }

    // Test 3: Try with a bad selector that needs healing
    totalTests++;
    console.log('\nTest 3: Find element with bad selector (should trigger healing)');
    const healResult = await pc.findWithHealing('h1.nonexistent-class');
    if (healResult.data && healResult.data.found) {
      console.log(`✅ Element found with healing!`);
      console.log(`   Strategy: ${healResult.data.strategy}`);
      console.log(`   Healed: ${healResult.data.healed}`);
      console.log(`   Attempts: ${healResult.data.attempts}`);
      passCount++;
    } else {
      console.log('❌ Healing failed to find element');
    }

    // Test 4: Click with healing
    totalTests++;
    console.log('\nTest 4: Click with self-healing');
    const clickResult = await pc.clickWithHealing('a:has-text("More information")');
    if (clickResult.success) {
      console.log(`✅ Click successful with strategy: ${clickResult.data.strategy}`);
      passCount++;
    } else {
      console.log('❌ Click failed');
    }

    // Test 5: Navigate to a form page for testing
    totalTests++;
    console.log('\nTest 5: Navigate to form page');
    const formNav = await pc.navigate('https://www.w3schools.com/html/html_forms.asp');
    if (formNav.success) {
      console.log('✅ Navigated to form page');
      passCount++;
    } else {
      console.log('❌ Failed to navigate to form page');
    }

    // Test 6: Fill form with healing
    totalTests++;
    console.log('\nTest 6: Fill form field with healing');
    const fillResult = await pc.fillWithHealing('input[type="text"]', 'Test Value');
    if (fillResult.success) {
      console.log(`✅ Form filled successfully`);
      console.log(`   Healed: ${fillResult.data.healed}`);
      passCount++;
    } else {
      console.log('❌ Form fill failed');
    }

    // Test 7: Get healing statistics
    totalTests++;
    console.log('\nTest 7: Get healing statistics');
    const statsResult = await pc.getHealingStats();
    if (statsResult.success) {
      console.log('✅ Statistics retrieved:');
      console.log(`   Total selectors: ${statsResult.data.totalSelectors}`);
      console.log(`   Total alternatives: ${statsResult.data.totalAlternatives}`);
      console.log(`   Average confidence: ${statsResult.data.averageConfidence.toFixed(2)}`);
      passCount++;
    } else {
      console.log('❌ Failed to get statistics');
    }

    // Test 8: Export healing history
    totalTests++;
    console.log('\nTest 8: Export/Import healing history');
    const exportResult = await pc.exportHealingHistory();
    if (exportResult.success) {
      const historyData = JSON.stringify(exportResult.data);
      const importResult = await pc.importHealingHistory(historyData);
      if (importResult.success) {
        console.log('✅ History exported and imported successfully');
        passCount++;
      } else {
        console.log('❌ Import failed');
      }
    } else {
      console.log('❌ Export failed');
    }

    // Test 9: Learning mode toggle
    totalTests++;
    console.log('\nTest 9: Toggle learning mode');
    const learningResult = await pc.setSelectorLearningMode(false);
    if (learningResult.success) {
      console.log('✅ Learning mode toggled successfully');
      passCount++;
    } else {
      console.log('❌ Failed to toggle learning mode');
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await pc.close();
    
    console.log('\n' + '='.repeat(50));
    console.log(`Test Results: ${passCount}/${totalTests} passed (${Math.round(passCount/totalTests * 100)}%)`);
    console.log('='.repeat(50));
    
    if (passCount === totalTests) {
      console.log('🎉 All tests passed!');
    } else {
      console.log(`⚠️ ${totalTests - passCount} tests failed`);
    }
  }
}

async function testPageChangeDetection() {
  console.log('\n\n📸 Testing Page Change Detection...\n');
  
  const pc = new PlayClone({ headless: false });
  let passCount = 0;
  let totalTests = 0;

  try {
    // Test 1: Navigate to a dynamic page
    totalTests++;
    console.log('Test 1: Navigate to dynamic page');
    const navResult = await pc.navigate('https://example.com');
    if (navResult.success) {
      console.log('✅ Navigation successful');
      passCount++;
    } else {
      console.log('❌ Navigation failed');
    }

    // Test 2: Capture initial snapshot
    totalTests++;
    console.log('\nTest 2: Capture page snapshot');
    const snapshotResult = await pc.capturePageSnapshot();
    if (snapshotResult.success) {
      console.log('✅ Snapshot captured:');
      console.log(`   Elements: ${snapshotResult.data.elementCount}`);
      console.log(`   Critical elements: ${snapshotResult.data.criticalElements}`);
      console.log(`   Hash: ${snapshotResult.data.domHash}`);
      passCount++;
    } else {
      console.log('❌ Snapshot failed');
    }

    // Test 3: Detect changes (should be none initially)
    totalTests++;
    console.log('\nTest 3: Detect changes (initial)');
    const changeResult1 = await pc.detectPageChanges();
    if (changeResult1.success) {
      console.log(`✅ Change detection completed:`);
      console.log(`   Has changed: ${changeResult1.data.hasChanged}`);
      console.log(`   Change score: ${changeResult1.data.changeScore}`);
      console.log(`   Confidence: ${changeResult1.data.confidence}`);
      passCount++;
    } else {
      console.log('❌ Change detection failed');
    }

    // Test 4: Navigate to a different page to trigger changes
    totalTests++;
    console.log('\nTest 4: Navigate to different page');
    await pc.navigate('https://www.w3schools.com');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page load
    
    // Test 5: Detect changes after navigation
    totalTests++;
    console.log('\nTest 5: Detect changes after navigation');
    const changeResult2 = await pc.detectPageChanges();
    if (changeResult2.success && changeResult2.data.hasChanged) {
      console.log('✅ Changes detected:');
      console.log(`   Change score: ${changeResult2.data.changeScore}`);
      console.log(`   Number of changes: ${changeResult2.data.changeCount}`);
      console.log(`   Adaptations applied: ${changeResult2.data.adaptationsApplied}`);
      passCount++;
    } else {
      console.log('❌ Expected changes not detected');
    }

    // Test 6: Get page change history
    totalTests++;
    console.log('\nTest 6: Get page change history');
    const historyResult = await pc.getPageChangeHistory();
    if (historyResult.success) {
      console.log(`✅ History retrieved: ${historyResult.data.length} snapshots`);
      passCount++;
    } else {
      console.log('❌ Failed to get history');
    }

    // Test 7: Export page change data
    totalTests++;
    console.log('\nTest 7: Export/Import page change data');
    const exportResult = await pc.exportPageChangeData();
    if (exportResult.success) {
      const data = JSON.stringify(exportResult.data);
      const importResult = await pc.importPageChangeData(data);
      if (importResult.success) {
        console.log('✅ Page change data exported and imported');
        passCount++;
      } else {
        console.log('❌ Import failed');
      }
    } else {
      console.log('❌ Export failed');
    }

    // Test 8: Clear history
    totalTests++;
    console.log('\nTest 8: Clear page change history');
    const clearResult = await pc.clearPageChangeHistory();
    if (clearResult.success) {
      console.log('✅ History cleared');
      passCount++;
    } else {
      console.log('❌ Failed to clear history');
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await pc.close();
    
    console.log('\n' + '='.repeat(50));
    console.log(`Test Results: ${passCount}/${totalTests} passed (${Math.round(passCount/totalTests * 100)}%)`);
    console.log('='.repeat(50));
    
    if (passCount === totalTests) {
      console.log('🎉 All tests passed!');
    } else {
      console.log(`⚠️ ${totalTests - passCount} tests failed`);
    }
  }
}

// Run both test suites
async function runAllTests() {
  console.log('🚀 PlayClone Self-Healing & Page Detection Test Suite');
  console.log('=' .repeat(50));
  
  await testSelfHealingSelectors();
  await testPageChangeDetection();
  
  console.log('\n✨ All tests completed!');
}

runAllTests().catch(console.error);