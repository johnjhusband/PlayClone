/**
 * Extension Injection Example
 * Demonstrates how to load browser extensions with PlayClone
 */

const { PlayClone } = require('../dist/index');
const path = require('path');

async function main() {
  console.log('=== PlayClone Extension Injection Demo ===\n');

  // Example 1: Load extension from local path
  console.log('Example 1: Loading extension from local path...');
  const pc1 = new PlayClone({
    headless: false, // Extensions require headed mode
    browser: 'chromium',
    extensions: [
      {
        // Path to unpacked extension directory
        path: path.join(__dirname, 'sample-extension'),
        // Optional: Override manifest permissions
        permissions: ['tabs', 'storage']
      }
    ]
  });

  try {
    await pc1.navigate('https://example.com');
    console.log('✅ Browser launched with local extension');
    
    // Get loaded extensions
    const extensions = pc1.getExtensions();
    console.log('Loaded extensions:', extensions);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc1.close();
  }

  // Example 2: Load extension from Chrome Web Store
  console.log('\nExample 2: Loading extension from Chrome Web Store...');
  const pc2 = new PlayClone({
    headless: false,
    browser: 'chromium',
    extensions: [
      {
        // Load React Developer Tools from Chrome Web Store
        id: 'fmkadmapgofadopljbjfkapdkoienihi'
      }
    ]
  });

  try {
    await pc2.navigate('https://reactjs.org');
    console.log('✅ Browser launched with Chrome Web Store extension');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc2.close();
  }

  // Example 3: Dynamic extension loading
  console.log('\nExample 3: Dynamic extension loading...');
  const pc3 = new PlayClone({
    headless: false,
    browser: 'chromium'
  });

  try {
    await pc3.navigate('https://example.com');
    console.log('Browser launched without extensions');
    
    // Load extension dynamically after launch
    const result = await pc3.loadExtension({
      path: path.join(__dirname, 'another-extension')
    });
    
    if (result.success) {
      console.log('✅ Extension loaded dynamically:', result.value);
    } else {
      console.log('❌ Failed to load extension:', result.error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc3.close();
  }

  // Example 4: Extension management
  console.log('\nExample 4: Extension management...');
  const pc4 = new PlayClone({
    headless: false,
    browser: 'chromium',
    extensions: [
      {
        path: path.join(__dirname, 'test-extension-1')
      },
      {
        path: path.join(__dirname, 'test-extension-2')
      }
    ]
  });

  try {
    await pc4.navigate('https://example.com');
    
    // List all extensions
    const allExtensions = pc4.getExtensions();
    console.log('All extensions:', allExtensions);
    
    if (allExtensions.length > 0) {
      const firstExtId = allExtensions[0].id;
      
      // Disable first extension
      const disableResult = pc4.setExtensionEnabled(firstExtId, false);
      console.log('Disabled extension:', disableResult);
      
      // Re-enable it
      const enableResult = pc4.setExtensionEnabled(firstExtId, true);
      console.log('Re-enabled extension:', enableResult);
      
      // Remove an extension
      const removeResult = pc4.removeExtension(firstExtId);
      console.log('Removed extension:', removeResult);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc4.close();
  }

  console.log('\n=== Extension Injection Demo Complete ===');
}

// Create a sample extension for testing
async function createSampleExtension() {
  const fs = require('fs');
  const extensionDir = path.join(__dirname, 'sample-extension');
  
  if (!fs.existsSync(extensionDir)) {
    fs.mkdirSync(extensionDir, { recursive: true });
    
    // Create manifest.json
    const manifest = {
      "manifest_version": 3,
      "name": "PlayClone Test Extension",
      "version": "1.0.0",
      "description": "A simple test extension for PlayClone",
      "permissions": ["storage"],
      "action": {
        "default_popup": "popup.html"
      },
      "background": {
        "service_worker": "background.js"
      }
    };
    
    fs.writeFileSync(
      path.join(extensionDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // Create popup.html
    fs.writeFileSync(
      path.join(extensionDir, 'popup.html'),
      `<!DOCTYPE html>
<html>
<head>
  <title>PlayClone Extension</title>
  <style>
    body { width: 200px; padding: 10px; }
  </style>
</head>
<body>
  <h3>PlayClone Test</h3>
  <p>Extension loaded!</p>
</body>
</html>`
    );
    
    // Create background.js
    fs.writeFileSync(
      path.join(extensionDir, 'background.js'),
      `console.log('PlayClone test extension loaded!');`
    );
    
    console.log('Created sample extension at:', extensionDir);
  }
}

// Run the demo
(async () => {
  await createSampleExtension();
  await main();
})().catch(console.error);