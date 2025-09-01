#!/usr/bin/env node

/**
 * WebSocket Demo
 * Demonstrates PlayClone's WebSocket interception with a local test page
 */

const { PlayClone } = require('../dist/index');

async function runWebSocketDemo() {
  console.log('🔌 WebSocket Interception Demo\n');
  console.log('=' .repeat(50));
  
  const pc = new PlayClone({ headless: false });
  
  try {
    // Create a local HTML page with WebSocket functionality
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>WebSocket Test</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; }
          button { padding: 10px 20px; margin: 5px; }
          #messages { 
            border: 1px solid #ccc; 
            padding: 10px; 
            height: 200px; 
            overflow-y: scroll; 
            margin: 20px 0;
            background: #f5f5f5;
          }
          .message { margin: 5px 0; }
          .sent { color: blue; }
          .received { color: green; }
          input { padding: 8px; width: 300px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>WebSocket Test Page</h1>
          <div>
            <button id="connect">Connect</button>
            <button id="disconnect">Disconnect</button>
            <span id="status">Disconnected</span>
          </div>
          <div id="messages"></div>
          <div>
            <input type="text" id="messageInput" placeholder="Enter message">
            <button id="send">Send</button>
          </div>
        </div>
        <script>
          let ws = null;
          const messages = document.getElementById('messages');
          const status = document.getElementById('status');
          const messageInput = document.getElementById('messageInput');
          
          function addMessage(text, type) {
            const div = document.createElement('div');
            div.className = 'message ' + type;
            div.textContent = new Date().toLocaleTimeString() + ' - ' + text;
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
          }
          
          document.getElementById('connect').onclick = () => {
            if (ws) return;
            
            // Use a public echo WebSocket server
            ws = new WebSocket('wss://echo.websocket.org/');
            
            ws.onopen = () => {
              status.textContent = 'Connected';
              status.style.color = 'green';
              addMessage('Connected to WebSocket server', 'received');
            };
            
            ws.onmessage = (event) => {
              addMessage('Received: ' + event.data, 'received');
            };
            
            ws.onclose = () => {
              status.textContent = 'Disconnected';
              status.style.color = 'red';
              addMessage('Disconnected from server', 'received');
              ws = null;
            };
            
            ws.onerror = (error) => {
              addMessage('Error: ' + error.message, 'received');
            };
          };
          
          document.getElementById('disconnect').onclick = () => {
            if (ws) {
              ws.close();
            }
          };
          
          document.getElementById('send').onclick = () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              const message = messageInput.value;
              if (message) {
                ws.send(message);
                addMessage('Sent: ' + message, 'sent');
                messageInput.value = '';
              }
            } else {
              alert('Not connected to WebSocket');
            }
          };
          
          messageInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
              document.getElementById('send').click();
            }
          };
        </script>
      </body>
      </html>
    `;
    
    // Navigate to data URL with the HTML content
    console.log('1️⃣ Loading test page...');
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
    await pc.navigate(dataUrl);
    
    // Enable WebSocket interception
    console.log('2️⃣ Enabling WebSocket interception...');
    const enableResult = await pc.enableWebSocketInterception();
    console.log(`   ${enableResult.success ? '✅' : '❌'} ${enableResult.success ? 'Enabled' : enableResult.error}`);
    
    // Add frame handlers
    console.log('3️⃣ Setting up frame handlers...');
    
    // Log all frames
    pc.addWebSocketFrameHandler('logger', (frame, connection) => {
      const data = typeof frame.data === 'string' ? frame.data : frame.data.toString();
      const preview = data.length > 50 ? data.substring(0, 50) + '...' : data;
      console.log(`   📨 [${frame.direction}] ${frame.type}: ${preview}`);
    });
    
    // Count messages
    let sentCount = 0;
    let receivedCount = 0;
    pc.addWebSocketFrameHandler('counter', (frame) => {
      if (frame.direction === 'sent') sentCount++;
      else receivedCount++;
    });
    
    // Add frame modifier to add a prefix to sent messages
    pc.addWebSocketFrameModifier('prefixer', (frame) => {
      if (frame.direction === 'sent' && frame.type === 'text' && typeof frame.data === 'string') {
        // Add prefix to outgoing messages
        frame.data = '[Modified] ' + frame.data;
      }
      return frame;
    });
    
    console.log('   ✅ Handlers configured');
    
    // Connect to WebSocket
    console.log('4️⃣ Connecting to WebSocket...');
    await pc.click('#connect');
    await pc.page.waitForTimeout(2000);
    
    // Send test messages
    console.log('5️⃣ Sending test messages...');
    const testMessages = [
      'Hello WebSocket!',
      'This is a test message',
      'PlayClone WebSocket interception works!',
      JSON.stringify({ type: 'json', data: 'test' })
    ];
    
    for (const msg of testMessages) {
      await pc.fill('#messageInput', msg);
      await pc.click('#send');
      await pc.page.waitForTimeout(500);
    }
    
    // Wait for responses
    console.log('6️⃣ Waiting for responses...');
    await pc.page.waitForTimeout(2000);
    
    // Get statistics
    console.log('\n7️⃣ WebSocket Statistics:');
    const stats = pc.getWebSocketStatistics();
    if (stats) {
      console.log(`   📊 Connections: ${stats.totalConnections} (${stats.activeConnections} active)`);
      console.log(`   📨 Frames: ${stats.totalFrames}`);
      console.log(`   📤 Sent: ${sentCount} messages (${stats.totalBytesSent} bytes)`);
      console.log(`   📥 Received: ${receivedCount} messages (${stats.totalBytesReceived} bytes)`);
      console.log(`   📝 Message types:`, stats.messageTypeDistribution);
    }
    
    // Get all frames
    console.log('\n8️⃣ Captured Frames:');
    const frames = pc.getWebSocketFrames();
    console.log(`   Total frames captured: ${frames.length}`);
    
    // Search for specific content
    console.log('\n9️⃣ Searching frames:');
    const helloFrames = pc.searchWebSocketFrames('Hello');
    console.log(`   Found ${helloFrames.length} frames containing "Hello"`);
    
    // Export capture
    console.log('\n🔟 Exporting capture...');
    const capture = pc.exportWebSocketCapture();
    if (capture) {
      console.log(`   ✅ Exported ${capture.connections.length} connections and ${capture.frames.length} frames`);
    }
    
    // Disconnect
    console.log('\n🔌 Disconnecting WebSocket...');
    await pc.click('#disconnect');
    await pc.page.waitForTimeout(1000);
    
    // Disable interception
    await pc.disableWebSocketInterception();
    console.log('   ✅ WebSocket interception disabled');
    
    console.log('\n' + '=' .repeat(50));
    console.log('✨ Demo completed successfully!');
    console.log('   WebSocket interception is working correctly.');
    
  } catch (error) {
    console.error('❌ Demo error:', error);
  } finally {
    // Keep browser open for a moment to see results
    await pc.page.waitForTimeout(3000);
    await pc.close();
  }
}

// Run the demo
console.log('Starting WebSocket interception demo...\n');
runWebSocketDemo().catch(console.error);