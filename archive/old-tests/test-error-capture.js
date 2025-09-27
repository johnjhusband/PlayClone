/**
 * Simple test to verify error capture works
 */

const { PlayClone } = require('./dist/index');
const path = require('path');

async function testErrorCapture() {
  const playclone = new PlayClone({
    headless: false,
    devtools: true
  });

  try {
    console.log('🚀 Testing error capture with known errors...\n');

    // IMPORTANT: Start error capture BEFORE navigation
    console.log('🎯 Starting error capture BEFORE navigation...');
    const captureResult = await playclone.startErrorCapture();
    console.log('Error capture started:', captureResult.success);

    // Also start deep error extraction for comprehensive capture
    console.log('🔬 Starting deep error extraction...');
    const deepResult = await playclone.startDeepErrorExtraction();
    console.log('Deep extraction started:', deepResult.success);

    // NOW navigate to test page with errors
    const testFile = path.join(__dirname, 'test-errors.html');
    console.log(`\n📄 Loading test page: ${testFile}`);

    const navResult = await playclone.navigate(`file://${testFile}`);
    if (!navResult.success) {
      console.error('Failed to navigate:', navResult.error);
      return;
    }

    // Wait for errors to be generated
    console.log('⏳ Waiting 3 seconds for all errors to generate...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Method 1: Get standard error capture report
    console.log('\n📊 Method 1: Standard Error Capture Report');
    console.log('=====================================');

    // Give it a moment to capture
    await new Promise(resolve => setTimeout(resolve, 1000));

    const errorReport = playclone.getErrorReport();
    console.log('Error Report:\n', errorReport);

    // Method 2: Enhanced DevTools Console
    console.log('\n🔧 Method 2: Enhanced DevTools Console');
    console.log('=========================================');
    const devToolsResult = await playclone.openDevToolsConsoleEnhanced();
    console.log('DevTools result:', devToolsResult.value);

    // Method 3: Extract all console entries
    console.log('\n📋 Method 3: Extract All Console Entries');
    console.log('===========================================');
    const entriesResult = await playclone.extractAllConsoleEntries();
    if (entriesResult.success && entriesResult.value) {
      console.log(`Total entries found: ${entriesResult.value.length}`);

      entriesResult.value.forEach((entry, index) => {
        console.log(`\n[${index + 1}] Level: ${entry.level}`);
        console.log(`    Text: ${entry.text}`);
        if (entry.url) {
          console.log(`    Location: ${entry.url}:${entry.lineNumber || '?'}:${entry.columnNumber || '?'}`);
        }
      });
    }

    // Method 4: Copy console errors
    console.log('\n📎 Method 4: Copy Console Errors');
    console.log('===================================');
    const copyResult = await playclone.copyConsoleErrors();
    if (copyResult.success) {
      console.log('Copied errors:\n', copyResult.value);
    }

    // Method 5: Get DevTools summary
    console.log('\n📈 Method 5: DevTools Console Summary');
    console.log('========================================');
    const summary = await playclone.getDevToolsConsoleSummary();
    if (summary) {
      console.log(`Error Count: ${summary.errorCount}`);
      console.log(`Warning Count: ${summary.warningCount}`);
      console.log(`Total Entries: ${summary.errors.length + summary.warnings.length + summary.logs.length}`);

      if (summary.errors.length > 0) {
        console.log('\n🔴 Errors Found:');
        summary.errors.forEach(err => {
          console.log(`  - ${err.text}`);
        });
      }
    }

    // Method 6: Get Deep Error Summary (THIS SHOULD WORK!)
    console.log('\n🔬 Method 6: Deep Error Summary');
    console.log('===================================');
    const deepSummary = await playclone.getDeepErrorSummary();
    if (deepSummary) {
      console.log(`Compilation Errors: ${deepSummary.compilationErrors.length}`);
      console.log(`Runtime Errors: ${deepSummary.runtimeErrors.length}`);
      console.log(`Console Errors: ${deepSummary.consoleErrors.length}`);
      console.log(`Network Errors: ${deepSummary.networkErrors.length}`);
      console.log(`Page Errors: ${deepSummary.pageErrors.length}`);

      if (deepSummary.consoleErrors.length > 0) {
        console.log('\n🔴 Console Errors Captured:');
        deepSummary.consoleErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.text}`);
        });
      }

      if (deepSummary.runtimeErrors.length > 0) {
        console.log('\n🔴 Runtime Errors Captured:');
        deepSummary.runtimeErrors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.message}`);
        });
      }
    }

    // Get the deep error report
    const deepReport = playclone.getDeepErrorReport();
    console.log('\n📝 Deep Error Report:');
    console.log(deepReport);

    console.log('\n✅ Test completed! Keeping browser open for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await playclone.close();
    console.log('👋 Browser closed');
  }
}

// Run the test
testErrorCapture().catch(console.error);