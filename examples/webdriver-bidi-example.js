/**
 * WebDriver BiDi Protocol Example
 * Demonstrates how to use PlayClone with WebDriver BiDi protocol
 */

const WebSocket = require('ws');
const { createBiDiServer } = require('../dist/compatibility/WebDriverBiDi');

// BiDi command helper
class BiDiClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.commandId = 0;
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    
    return new Promise((resolve, reject) => {
      this.ws.on('open', () => {
        console.log('✅ Connected to BiDi server');
        resolve();
      });
      this.ws.on('error', reject);
      
      // Listen for events
      this.ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (!message.id) {
          // This is an event, not a command response
          console.log('📢 Event:', message.method, message.params);
        }
      });
    });
  }

  async sendCommand(method, params = {}) {
    const id = ++this.commandId;
    
    return new Promise((resolve, reject) => {
      const listener = (data) => {
        const response = JSON.parse(data);
        if (response.id === id) {
          this.ws.removeListener('message', listener);
          if (response.error) {
            reject(new Error(`BiDi Error: ${response.error.message}`));
          } else {
            resolve(response.result);
          }
        }
      };
      
      this.ws.on('message', listener);
      this.ws.send(JSON.stringify({ id, method, params }));
      
      // Timeout after 10 seconds
      setTimeout(() => {
        this.ws.removeListener('message', listener);
        reject(new Error('Command timeout'));
      }, 10000);
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runExample() {
  console.log('🚀 WebDriver BiDi Protocol Example\n');
  console.log('This example demonstrates how to control PlayClone using the');
  console.log('W3C WebDriver BiDi protocol for bidirectional browser control.\n');
  
  let bidiServer;
  let client;

  try {
    // Start BiDi server
    console.log('1️⃣ Starting BiDi server...');
    bidiServer = await createBiDiServer(9224);
    console.log('   Server running on ws://localhost:9224\n');

    // Connect client
    console.log('2️⃣ Connecting BiDi client...');
    client = new BiDiClient('ws://localhost:9224');
    await client.connect();
    console.log();

    // Create session
    console.log('3️⃣ Creating browser session...');
    const session = await client.sendCommand('session.new', {
      capabilities: {
        browserName: 'chromium',
        acceptInsecureCerts: true
      }
    });
    const sessionId = session.sessionId;
    const contextId = session.contexts[0];
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Context ID: ${contextId}\n`);

    // Subscribe to events
    console.log('4️⃣ Subscribing to browser events...');
    await client.sendCommand('session.subscribe', {
      events: [
        'browsingContext.domContentLoaded',
        'browsingContext.load',
        'browsingContext.navigationStarted'
      ]
    });
    console.log('   Subscribed to navigation events\n');

    // Navigate to a website
    console.log('5️⃣ Navigating to example.com...');
    const nav = await client.sendCommand('browsingContext.navigate', {
      context: contextId,
      url: 'https://example.com',
      wait: 'complete'
    });
    console.log(`   Navigation ID: ${nav.navigation}`);
    console.log(`   Current URL: ${nav.url}\n`);

    // Execute JavaScript
    console.log('6️⃣ Executing JavaScript in browser...');
    const titleResult = await client.sendCommand('script.evaluate', {
      context: contextId,
      expression: 'document.title'
    });
    console.log(`   Page title: ${titleResult.result.value}\n`);

    // Call a function with arguments
    console.log('7️⃣ Calling function with arguments...');
    const funcResult = await client.sendCommand('script.callFunction', {
      context: contextId,
      functionDeclaration: `
        function(selector) {
          const element = document.querySelector(selector);
          return element ? element.textContent : null;
        }
      `,
      arguments: [{ type: 'string', value: 'h1' }]
    });
    console.log(`   H1 text: ${funcResult.result.value}\n`);

    // Get all links on the page
    console.log('8️⃣ Extracting all links...');
    const linksResult = await client.sendCommand('script.evaluate', {
      context: contextId,
      expression: `
        Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent,
          href: a.href
        }))
      `
    });
    console.log(`   Found ${linksResult.result.value?.length || 0} links\n`);

    // Take a screenshot
    console.log('9️⃣ Taking screenshot...');
    const screenshot = await client.sendCommand('browsingContext.captureScreenshot', {
      context: contextId,
      options: {
        format: 'png',
        fullPage: false
      }
    });
    console.log(`   Screenshot captured: ${screenshot.data.substring(0, 50)}...`);
    console.log(`   Size: ${screenshot.data.length} bytes (base64)\n`);

    // Set viewport size
    console.log('🔟 Setting viewport size...');
    await client.sendCommand('browsingContext.setViewport', {
      context: contextId,
      viewport: { width: 1920, height: 1080 }
    });
    console.log('   Viewport set to 1920x1080\n');

    // Get cookies
    console.log('1️⃣1️⃣ Getting cookies...');
    const cookies = await client.sendCommand('storage.getCookies', {
      context: contextId
    });
    console.log(`   Found ${cookies.cookies.length} cookies`);
    if (cookies.cookies.length > 0) {
      cookies.cookies.forEach(cookie => {
        console.log(`   - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
      });
    }
    console.log();

    // Perform mouse click
    console.log('1️⃣2️⃣ Performing mouse click...');
    await client.sendCommand('input.performActions', {
      context: contextId,
      actions: [{
        type: 'pointer',
        id: 'mouse',
        actions: [
          { type: 'pointerMove', x: 500, y: 300 },
          { type: 'pause', duration: 100 },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerUp', button: 0 }
        ]
      }]
    });
    console.log('   Clicked at position (500, 300)\n');

    // Create a new browsing context (new tab)
    console.log('1️⃣3️⃣ Creating new tab...');
    const newTab = await client.sendCommand('browsingContext.create', {
      type: 'tab'
    });
    console.log(`   New tab created: ${newTab.context}`);
    
    // Navigate in new tab
    await client.sendCommand('browsingContext.navigate', {
      context: newTab.context,
      url: 'https://www.google.com',
      wait: 'complete'
    });
    console.log('   Navigated to Google in new tab\n');

    // Get context tree
    console.log('1️⃣4️⃣ Getting browser context tree...');
    const tree = await client.sendCommand('browsingContext.getTree');
    console.log(`   Total contexts: ${tree.contexts.length}`);
    tree.contexts.forEach(ctx => {
      console.log(`   - ${ctx.context}: ${ctx.url}`);
    });
    console.log();

    // Print to PDF
    console.log('1️⃣5️⃣ Printing page to PDF...');
    const pdf = await client.sendCommand('browsingContext.print', {
      context: contextId,
      options: {
        format: 'A4',
        landscape: false
      }
    });
    console.log(`   PDF generated: ${pdf.data.substring(0, 50)}...`);
    console.log(`   Size: ${pdf.data.length} bytes (base64)\n`);

    // Close the new tab
    console.log('1️⃣6️⃣ Closing new tab...');
    await client.sendCommand('browsingContext.close', {
      context: newTab.context
    });
    console.log('   Tab closed\n');

    // End session
    console.log('1️⃣7️⃣ Ending session...');
    await client.sendCommand('session.end', {
      sessionId: sessionId
    });
    console.log('   Session ended\n');

    console.log('✅ Example completed successfully!');
    console.log('\n📚 Key Concepts Demonstrated:');
    console.log('   • Creating BiDi sessions and contexts');
    console.log('   • Navigating to URLs');
    console.log('   • Executing JavaScript and calling functions');
    console.log('   • Taking screenshots and generating PDFs');
    console.log('   • Managing cookies and viewport');
    console.log('   • Performing input actions (mouse/keyboard)');
    console.log('   • Managing multiple tabs/contexts');
    console.log('   • Subscribing to browser events');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    
    if (client) {
      client.close();
      console.log('✅ Client disconnected');
    }
    
    if (bidiServer) {
      await bidiServer.stop();
      console.log('✅ BiDi server stopped');
    }
  }
}

// Run the example
console.log('═'.repeat(60));
console.log(' WebDriver BiDi Protocol Example for PlayClone');
console.log('═'.repeat(60));
console.log();

runExample().catch(console.error);