#!/usr/bin/env node

/**
 * Test script for PlayClone tab management functionality
 */

const { PlayClone } = require('../dist/index');

async function testTabManagement() {
  console.log('🧪 Testing PlayClone Tab Management\n');
  const pc = new PlayClone({ headless: false });
  
  try {
    // Test 1: Open initial tab
    console.log('Test 1: Navigate to initial page...');
    const nav1 = await pc.navigate('https://example.com');
    console.log(`✅ Initial navigation: ${nav1.success ? 'Success' : 'Failed'}`);
    if (nav1.value) console.log(`   Title: ${nav1.value.title}`);
    
    // Test 2: Open new tab
    console.log('\nTest 2: Open new tab with URL...');
    const tab1 = await pc.openTab('https://www.google.com');
    console.log(`✅ New tab opened: ${tab1.success ? 'Success' : 'Failed'}`);
    if (tab1.value?.tabId) console.log(`   Tab ID: ${tab1.value.tabId}`);
    if (tab1.value?.title) console.log(`   Title: ${tab1.value.title}`);
    
    // Test 3: Open another tab
    console.log('\nTest 3: Open another tab...');
    const tab2 = await pc.openTab('https://github.com');
    console.log(`✅ Another tab opened: ${tab2.success ? 'Success' : 'Failed'}`);
    if (tab2.value?.tabId) console.log(`   Tab ID: ${tab2.value.tabId}`);
    
    // Test 4: Get all tabs
    console.log('\nTest 4: Get all tabs...');
    const tabs = await pc.getTabs();
    console.log(`✅ Got tabs: ${tabs.success ? 'Success' : 'Failed'}`);
    if (tabs.value?.tabs) {
      console.log(`   Total tabs: ${tabs.value.tabs.length}`);
      tabs.value.tabs.forEach((tab, i) => {
        console.log(`   Tab ${i}: ${tab.title} (${tab.active ? 'active' : 'inactive'})`);
      });
    }
    
    // Test 5: Switch to first tab by index
    console.log('\nTest 5: Switch to first tab by index...');
    const switch1 = await pc.switchTabByIndex(0);
    console.log(`✅ Switched to tab 0: ${switch1.success ? 'Success' : 'Failed'}`);
    if (switch1.value?.title) console.log(`   Active tab: ${switch1.value.title}`);
    
    // Test 6: Switch to specific tab by ID
    console.log('\nTest 6: Switch to tab by ID...');
    if (tab1.value?.tabId) {
      const switch2 = await pc.switchTab(tab1.value.tabId);
      console.log(`✅ Switched to Google tab: ${switch2.success ? 'Success' : 'Failed'}`);
      if (switch2.value?.title) console.log(`   Active tab: ${switch2.value.title}`);
    }
    
    // Test 7: Navigate in specific tab
    console.log('\nTest 7: Navigate in specific tab...');
    if (tab2.value?.tabId) {
      const nav2 = await pc.navigateInTab(tab2.value.tabId, 'https://nodejs.org');
      console.log(`✅ Navigated in tab: ${nav2.success ? 'Success' : 'Failed'}`);
      if (nav2.value?.title) console.log(`   New title: ${nav2.value.title}`);
    }
    
    // Test 8: Duplicate a tab
    console.log('\nTest 8: Duplicate current tab...');
    const dup = await pc.duplicateTab();
    console.log(`✅ Duplicated tab: ${dup.success ? 'Success' : 'Failed'}`);
    if (dup.value?.tabId) console.log(`   New tab ID: ${dup.value.tabId}`);
    
    // Test 9: Find tab by query
    console.log('\nTest 9: Find tab by query...');
    const found = await pc.findTab('example');
    console.log(`✅ Found tab: ${found.success ? 'Success' : 'Failed'}`);
    if (found.value?.title) console.log(`   Found: ${found.value.title}`);
    
    // Test 10: Reload a tab
    console.log('\nTest 10: Reload current tab...');
    const reload = await pc.reloadTab();
    console.log(`✅ Reloaded tab: ${reload.success ? 'Success' : 'Failed'}`);
    
    // Test 11: Close a tab
    console.log('\nTest 11: Close duplicate tab...');
    if (dup.value?.tabId) {
      const close = await pc.closeTab(dup.value.tabId);
      console.log(`✅ Closed tab: ${close.success ? 'Success' : 'Failed'}`);
    }
    
    // Test 12: Close other tabs
    console.log('\nTest 12: Close all tabs except current...');
    const closeOthers = await pc.closeOtherTabs();
    console.log(`✅ Closed other tabs: ${closeOthers.success ? 'Success' : 'Failed'}`);
    if (closeOthers.value?.closedCount !== undefined) {
      console.log(`   Closed ${closeOthers.value.closedCount} tabs`);
    }
    
    // Final tab count
    console.log('\nFinal tab count check...');
    const finalTabs = await pc.getTabs();
    if (finalTabs.value?.tabs) {
      console.log(`✅ Remaining tabs: ${finalTabs.value.tabs.length}`);
    }
    
    // Wait a bit to see the results
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('\nClosing browser...');
    await pc.close();
    console.log('✨ Tab management tests complete!');
  }
}

// Run the test
testTabManagement().catch(console.error);