#!/usr/bin/env node

/**
 * WebDriver BiDi Server for PlayClone
 * Standalone server that provides W3C WebDriver BiDi protocol access to PlayClone
 * 
 * Usage:
 *   node webdriver-bidi-server.js [options]
 * 
 * Options:
 *   --port, -p <number>    Port to listen on (default: 9222)
 *   --headless             Run browsers in headless mode
 *   --help, -h             Show this help message
 * 
 * Environment Variables:
 *   BIDI_PORT              Port to listen on (default: 9222)
 *   PLAYCLONE_HEADLESS     Run browsers in headless mode (true/false)
 * 
 * Example:
 *   node webdriver-bidi-server.js --port 9222
 *   BIDI_PORT=9223 node webdriver-bidi-server.js
 */

const { createBiDiServer } = require('./dist/compatibility/WebDriverBiDi');

// Parse command line arguments
const args = process.argv.slice(2);
let port = parseInt(process.env.BIDI_PORT || '9222', 10);
let headless = process.env.PLAYCLONE_HEADLESS === 'true';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--help' || arg === '-h') {
    console.log(`
WebDriver BiDi Server for PlayClone

Usage:
  node webdriver-bidi-server.js [options]

Options:
  --port, -p <number>    Port to listen on (default: 9222)
  --headless             Run browsers in headless mode
  --help, -h             Show this help message

Environment Variables:
  BIDI_PORT              Port to listen on (default: 9222)
  PLAYCLONE_HEADLESS     Run browsers in headless mode (true/false)

Example:
  node webdriver-bidi-server.js --port 9222
  BIDI_PORT=9223 node webdriver-bidi-server.js

WebDriver BiDi Protocol:
  The server implements the W3C WebDriver BiDi specification, providing
  bidirectional communication with browsers. Connect using WebSocket to
  ws://localhost:${port}

Supported Commands:
  - session.*: Session management (new, status, subscribe, unsubscribe, end)
  - browsingContext.*: Browser control (create, navigate, reload, print, screenshot)
  - script.*: JavaScript execution (evaluate, callFunction, getRealms)
  - network.*: Network interception (addIntercept, continueRequest, failRequest)
  - storage.*: Cookie management (getCookies, setCookie, deleteCookies)
  - input.*: User input simulation (performActions, releaseActions)
  - browser.*: Browser management (close, getUserContexts)

For more information:
  https://github.com/johnjhusband/PlayClone
  https://w3c.github.io/webdriver-bidi/
    `);
    process.exit(0);
  }
  
  if (arg === '--port' || arg === '-p') {
    const nextArg = args[i + 1];
    if (nextArg && !nextArg.startsWith('-')) {
      port = parseInt(nextArg, 10);
      i++;
    }
  }
  
  if (arg === '--headless') {
    headless = true;
  }
}

// Validate port
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Error: Invalid port number: ${port}`);
  process.exit(1);
}

// ASCII art banner
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██████╗ ██╗      █████╗ ██╗   ██╗ ██████╗██╗      ██████╗  ║
║   ██╔══██╗██║     ██╔══██╗╚██╗ ██╔╝██╔════╝██║     ██╔═══██╗ ║
║   ██████╔╝██║     ███████║ ╚████╔╝ ██║     ██║     ██║   ██║ ║
║   ██╔═══╝ ██║     ██╔══██║  ╚██╔╝  ██║     ██║     ██║   ██║ ║
║   ██║     ███████╗██║  ██║   ██║   ╚██████╗███████╗╚██████╔╝ ║
║   ╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝╚══════╝ ╚═════╝  ║
║                                                               ║
║              WebDriver BiDi Protocol Server                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('🚀 Starting WebDriver BiDi Server...\n');
console.log(`📋 Configuration:`);
console.log(`   Port: ${port}`);
console.log(`   Headless: ${headless}`);
console.log(`   WebSocket URL: ws://localhost:${port}`);
console.log();

// Start the server
async function startServer() {
  try {
    const server = await createBiDiServer(port);
    
    console.log('✅ Server started successfully!');
    console.log();
    console.log('📡 Waiting for WebDriver BiDi connections...');
    console.log('   Connect your WebDriver client to: ws://localhost:' + port);
    console.log();
    console.log('💡 Tips:');
    console.log('   - Use any W3C WebDriver BiDi compatible client');
    console.log('   - Test with: wscat -c ws://localhost:' + port);
    console.log('   - Send commands as JSON: {"id":1,"method":"session.status","params":{}}');
    console.log();
    console.log('🛑 Press Ctrl+C to stop the server');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down server...');
      await server.stop();
      console.log('✅ Server stopped');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Shutting down server...');
      await server.stop();
      console.log('✅ Server stopped');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error();
    console.error('Common issues:');
    console.error('  - Port already in use: Try a different port with --port');
    console.error('  - Missing dependencies: Run "npm install"');
    console.error('  - Build errors: Run "npm run build"');
    process.exit(1);
  }
}

// Start the server
startServer().catch(console.error);