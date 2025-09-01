#!/usr/bin/env node

/**
 * Test script for PlayClone change monitoring and alerts
 */

const { PlayClone } = require('../dist/index');

async function testChangeMonitoring() {
  console.log('🔍 Testing PlayClone Change Monitoring...\n');
  
  const pc = new PlayClone({ headless: true });
  
  try {
    // Initialize browser
    await pc.init();
    console.log('✅ Browser initialized');
    
    // Test 1: Add monitoring target
    console.log('\n📌 Test 1: Adding monitoring target...');
    const result1 = await pc.addMonitorTarget(
      'https://example.com',
      'h1',
      5000 // Check every 5 seconds
    );
    console.log('Target added:', result1.value);
    const targetId = result1.value.targetId;
    
    // Test 2: Get monitoring targets
    console.log('\n📌 Test 2: Getting monitoring targets...');
    const result2 = await pc.getMonitorTargets();
    console.log('Active targets:', result2.value.length);
    console.log('Target details:', result2.value[0]);
    
    // Test 3: Check target immediately
    console.log('\n📌 Test 3: Checking target immediately...');
    const result3 = await pc.checkMonitorTarget(targetId);
    console.log('Check result:', result3.value);
    
    // Test 4: Configure alerts
    console.log('\n📌 Test 4: Configuring console alerts...');
    const result4 = await pc.configureMonitorAlerts('console', {});
    console.log('Alert configuration:', result4.value);
    
    // Test 5: Get monitor history
    console.log('\n📌 Test 5: Getting monitor history...');
    const result5 = await pc.getMonitorHistory(targetId);
    console.log('History entries:', result5.value.length);
    
    // Test 6: Stop monitoring
    console.log('\n📌 Test 6: Stopping monitoring...');
    const result6 = await pc.stopMonitoringTarget(targetId);
    console.log('Stop result:', result6.value);
    
    // Test 7: Remove target
    console.log('\n📌 Test 7: Removing monitoring target...');
    const result7 = await pc.removeMonitorTarget(targetId);
    console.log('Remove result:', result7.value);
    
    // Test 8: Test with multiple targets
    console.log('\n📌 Test 8: Testing multiple targets...');
    const targets = [
      { url: 'https://example.com', selector: 'title' },
      { url: 'https://example.com', selector: 'body' },
      { url: 'https://example.com', selector: 'meta[name="viewport"]' }
    ];
    
    const targetIds = [];
    for (const target of targets) {
      const result = await pc.addMonitorTarget(
        target.url,
        target.selector,
        10000
      );
      targetIds.push(result.value.targetId);
      console.log(`Added target for ${target.selector}: ${result.value.targetId}`);
    }
    
    // Check all targets
    console.log('\nChecking all targets...');
    for (const id of targetIds) {
      await pc.checkMonitorTarget(id);
    }
    
    // Get all targets
    const allTargets = await pc.getMonitorTargets();
    console.log(`Total active targets: ${allTargets.value.length}`);
    
    // Clean up
    for (const id of targetIds) {
      await pc.removeMonitorTarget(id);
    }
    
    console.log('\n✅ All change monitoring tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pc.close();
    console.log('\n👋 Browser closed');
  }
}

// Test webhook alerts (simulated)
async function testWebhookAlerts() {
  console.log('\n🔔 Testing Webhook Alerts...\n');
  
  const pc = new PlayClone({ headless: true });
  
  try {
    await pc.init();
    
    // Add target with webhook alert
    console.log('Adding target with webhook alert...');
    const result = await pc.addMonitorTarget(
      'https://example.com',
      'h1',
      5000,
      'https://webhook.site/test' // Example webhook URL
    );
    
    console.log('Target with webhook added:', result.value);
    
    // Trigger a check
    await pc.checkMonitorTarget(result.value.targetId);
    console.log('Check completed - webhook would be called on changes');
    
    // Clean up
    await pc.removeMonitorTarget(result.value.targetId);
    
    console.log('✅ Webhook alert test completed');
    
  } catch (error) {
    console.error('❌ Webhook test failed:', error);
  } finally {
    await pc.close();
  }
}

// Test change detection simulation
async function testChangeDetection() {
  console.log('\n🔄 Testing Change Detection...\n');
  
  const pc = new PlayClone({ headless: true });
  
  try {
    await pc.init();
    
    // Navigate to a dynamic page (we'll use example.com and simulate changes)
    await pc.navigate('https://example.com');
    
    // Add monitoring for the h1 element
    console.log('Setting up monitoring for h1 element...');
    const result = await pc.addMonitorTarget(
      'https://example.com',
      'h1',
      3000 // Check every 3 seconds
    );
    const targetId = result.value.targetId;
    
    // Configure console alerts to see changes
    await pc.configureMonitorAlerts('console', {});
    
    // Initial check
    console.log('Performing initial check...');
    await pc.checkMonitorTarget(targetId);
    
    // Simulate a change by modifying the page
    console.log('Simulating page change...');
    await pc.page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (h1) {
        h1.textContent = 'Modified Example Domain';
      }
    });
    
    // Check again to detect the change
    console.log('Checking for changes...');
    await pc.checkMonitorTarget(targetId);
    
    // Get history to see the change event
    const history = await pc.getMonitorHistory(targetId);
    console.log(`Change events detected: ${history.value.length}`);
    
    if (history.value.length > 0) {
      console.log('Latest change:', {
        type: history.value[0].changeType,
        timestamp: history.value[0].timestamp
      });
    }
    
    // Clean up
    await pc.removeMonitorTarget(targetId);
    
    console.log('✅ Change detection test completed');
    
  } catch (error) {
    console.error('❌ Change detection test failed:', error);
  } finally {
    await pc.close();
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 PlayClone Change Monitoring Test Suite\n');
  console.log('=' .repeat(50));
  
  await testChangeMonitoring();
  
  console.log('\n' + '='.repeat(50));
  await testWebhookAlerts();
  
  console.log('\n' + '='.repeat(50));
  await testChangeDetection();
  
  console.log('\n' + '='.repeat(50));
  console.log('✨ All tests completed!');
}

// Run the tests
runAllTests().catch(console.error);