/**
 * KineticUranium Error Capture Example
 * This example demonstrates how to use PlayClone's enhanced DevTools console features
 * to capture errors that are difficult to extract programmatically
 */

const { PlayClone } = require('../dist/index');

async function captureKineticUraniumErrors() {
  const playclone = new PlayClone({
    headless: false, // Keep browser visible to see DevTools
    devtools: true   // Enable DevTools
  });

  try {
    console.log('🚀 Starting KineticUranium error capture test...');

    // Launch browser
    const launchResult = await playclone.launch();
    if (!launchResult.success) {
      console.error('Failed to launch browser:', launchResult.error);
      return;
    }

    // Navigate to KineticUranium test file
    // Using the local test-direct.html file
    const navResult = await playclone.navigate(`file://${__dirname}/../../Kinetic Uranium/frontend/test-direct.html`);
    if (!navResult.success) {
      console.error('Failed to navigate:', navResult.error);
      return;
    }

    console.log('📍 Navigated to KineticUranium');

    // Wait for page to load
    await playclone.wait(2000);

    // Method 1: Start enhanced error capture before any errors occur
    console.log('🎯 Starting enhanced error capture...');
    const startResult = await playclone.startErrorCapture();
    console.log('Error capture started:', startResult.success);

    // Method 2: Use enhanced DevTools console opening
    console.log('🔧 Opening DevTools Console with enhanced method...');
    const devToolsResult = await playclone.openDevToolsConsoleEnhanced();
    console.log('DevTools opened:', devToolsResult.value);

    // Wait a moment for DevTools to fully open
    await playclone.wait(1500);

    // Method 3: Extract all console entries using CDP
    console.log('📊 Extracting all console entries...');
    const entriesResult = await playclone.extractAllConsoleEntries();
    if (entriesResult.success && entriesResult.value) {
      console.log(`Found ${entriesResult.value.length} console entries`);

      // Filter for errors
      const errors = entriesResult.value.filter(entry => entry.level === 'error');
      console.log(`\\n🔴 Found ${errors.length} errors:`);

      errors.forEach((error, index) => {
        console.log(`\\nError #${index + 1}:`);
        console.log(`  Level: ${error.level}`);
        console.log(`  Message: ${error.text}`);
        if (error.url) {
          console.log(`  URL: ${error.url}:${error.lineNumber || '?'}:${error.columnNumber || '?'}`);
        }
        if (error.stackTrace) {
          console.log(`  Stack Trace:\\n${error.stackTrace}`);
        }
      });
    }

    // Method 4: Copy console errors to clipboard
    console.log('\\n📋 Copying console errors to clipboard...');
    const copyResult = await playclone.copyConsoleErrors();
    if (copyResult.success) {
      console.log('Errors copied to clipboard!');
      console.log('\\nCopied content preview:');
      console.log(copyResult.value.substring(0, 500) + '...');
    }

    // Method 5: Get DevTools console summary
    console.log('\\n📈 Getting DevTools console summary...');
    const summary = await playclone.getDevToolsConsoleSummary();
    if (summary) {
      console.log(`Total Errors: ${summary.errorCount}`);
      console.log(`Total Warnings: ${summary.warningCount}`);
      console.log(`Total Console Entries: ${summary.errors.length + summary.warnings.length + summary.logs.length}`);
    }

    // Method 6: Try to select and copy directly from console UI (experimental)
    console.log('\\n🔍 Attempting to select and copy from console UI...');
    const selectCopyResult = await playclone.selectAndCopyFromConsole();
    if (selectCopyResult.success) {
      console.log('Console content copied from UI!');
      console.log('Content preview:', selectCopyResult.value.substring(0, 300) + '...');
    }

    // Method 7: Get standard error report
    console.log('\\n📝 Getting error report...');
    const errorReport = playclone.getErrorReport();
    console.log('Error Report:');
    console.log(errorReport);

    // Method 8: Get deep error summary (most comprehensive)
    console.log('\\n🔬 Getting deep error summary...');
    const deepSummary = await playclone.getDeepErrorSummary();
    if (deepSummary) {
      console.log('Deep Error Summary:');
      console.log(`  Compilation Errors: ${deepSummary.compilationErrors.length}`);
      console.log(`  Runtime Errors: ${deepSummary.runtimeErrors.length}`);
      console.log(`  Network Errors: ${deepSummary.networkErrors.length}`);
      console.log(`  Console Errors: ${deepSummary.consoleErrors.length}`);

      if (deepSummary.compilationErrors.length > 0) {
        console.log('\\n  Compilation Errors Found:');
        deepSummary.compilationErrors.forEach((err, i) => {
          console.log(`    ${i + 1}. ${err.message}`);
          if (err.filename) {
            console.log(`       File: ${err.filename}:${err.line}:${err.column}`);
          }
        });
      }
    }

    console.log('\\n✅ Error capture test completed!');
    console.log('\\n💡 Tips for better error capture:');
    console.log('1. Start error capture BEFORE navigating to catch page load errors');
    console.log('2. Use openDevToolsConsoleEnhanced() for reliable DevTools opening');
    console.log('3. copyConsoleErrors() uses CDP for accurate error extraction');
    console.log('4. extractAllConsoleEntries() gets the complete console history');
    console.log('5. For compilation errors, use startDeepErrorExtraction() before navigation');

    // Keep browser open for manual inspection
    console.log('\\n🔎 Browser will stay open for 10 seconds for manual inspection...');
    await playclone.wait(10000);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    await playclone.close();
    console.log('\\n👋 Test finished, browser closed');
  }
}

// Additional helper function to test with deep error extraction
async function captureWithDeepExtraction() {
  const playclone = new PlayClone({
    headless: false,
    devtools: true
  });

  try {
    console.log('🚀 Starting deep error extraction test...');

    // Launch browser
    await playclone.launch();

    // IMPORTANT: Start deep error extraction BEFORE navigation
    // This captures compilation errors and page load errors
    console.log('🔬 Starting deep error extraction BEFORE navigation...');
    await playclone.startDeepErrorExtraction();

    // Now navigate to the page
    console.log('📍 Navigating to KineticUranium...');
    await playclone.navigate(`file://${__dirname}/../../Kinetic Uranium/frontend/test-direct.html`);

    // Wait for page to fully load
    await playclone.wait(3000);

    // Open enhanced DevTools console
    await playclone.openDevToolsConsoleEnhanced();

    // Extract all errors
    const allEntries = await playclone.extractAllConsoleEntries();
    const deepSummary = await playclone.getDeepErrorSummary();

    console.log('\\n📊 Deep Extraction Results:');
    if (deepSummary) {
      console.log(`Total Errors Captured: ${
        deepSummary.compilationErrors.length +
        deepSummary.runtimeErrors.length +
        deepSummary.consoleErrors.length
      }`);

      // Display all errors
      if (deepSummary.compilationErrors.length > 0) {
        console.log('\\n🔴 Compilation Errors:');
        deepSummary.compilationErrors.forEach(err => {
          console.log(`  - ${err.message}`);
        });
      }

      if (deepSummary.runtimeErrors.length > 0) {
        console.log('\\n🔴 Runtime Errors:');
        deepSummary.runtimeErrors.forEach(err => {
          console.log(`  - ${err.message}`);
        });
      }

      if (deepSummary.consoleErrors.length > 0) {
        console.log('\\n🔴 Console Errors:');
        deepSummary.consoleErrors.forEach(err => {
          console.log(`  - ${err.text}`);
        });
      }
    }

    // Copy all errors to clipboard
    const copiedText = await playclone.copyConsoleErrors();
    console.log('\\n📋 All errors copied to clipboard!');

    // Keep open for inspection
    await playclone.wait(10000);

  } finally {
    await playclone.close();
  }
}

// Run the test
if (require.main === module) {
  console.log('Choose test mode:');
  console.log('1. Standard error capture');
  console.log('2. Deep error extraction (captures compilation errors)');
  console.log('');
  console.log('Running both tests...\\n');

  // Run standard test first
  captureKineticUraniumErrors()
    .then(() => {
      console.log('\\n=================================\\n');
      // Then run deep extraction test
      return captureWithDeepExtraction();
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = {
  captureKineticUraniumErrors,
  captureWithDeepExtraction
};