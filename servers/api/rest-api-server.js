#!/usr/bin/env node

/**
 * PlayClone REST API Server
 * 
 * Standalone script to run PlayClone as a REST API service
 * 
 * Usage:
 *   node rest-api-server.js [options]
 * 
 * Options:
 *   --port <number>      Port to listen on (default: 3000)
 *   --host <string>      Host to bind to (default: localhost)
 *   --api-key <string>   API key for authentication
 *   --max-sessions <n>   Maximum concurrent sessions (default: 10)
 *   --timeout <minutes>  Session timeout in minutes (default: 30)
 *   --websocket          Enable WebSocket support
 *   --cors <origin>      CORS origin (default: *)
 */

const { RestApiServer } = require('./dist/server/RestApiServer');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    port: 3000,
    host: 'localhost',
    apiKey: '',
    maxSessions: 10,
    sessionTimeout: 30,
    enableWebSocket: false,
    corsOrigin: '*'
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
        config.port = parseInt(args[++i]);
        break;
      case '--host':
        config.host = args[++i];
        break;
      case '--api-key':
        config.apiKey = args[++i];
        break;
      case '--max-sessions':
        config.maxSessions = parseInt(args[++i]);
        break;
      case '--timeout':
        config.sessionTimeout = parseInt(args[++i]);
        break;
      case '--websocket':
        config.enableWebSocket = true;
        break;
      case '--cors':
        config.corsOrigin = args[++i];
        break;
      case '--help':
        showHelp();
        process.exit(0);
    }
  }
  
  return config;
}

function showHelp() {
  console.log(`
PlayClone REST API Server

Usage:
  node rest-api-server.js [options]

Options:
  --port <number>      Port to listen on (default: 3000)
  --host <string>      Host to bind to (default: localhost)
  --api-key <string>   API key for authentication
  --max-sessions <n>   Maximum concurrent sessions (default: 10)
  --timeout <minutes>  Session timeout in minutes (default: 30)
  --websocket          Enable WebSocket support
  --cors <origin>      CORS origin (default: *)
  --help               Show this help message

Examples:
  # Start server on default port
  node rest-api-server.js

  # Start with API key authentication
  node rest-api-server.js --api-key my-secret-key

  # Start with WebSocket support on port 8080
  node rest-api-server.js --port 8080 --websocket

  # Start with custom session limits
  node rest-api-server.js --max-sessions 20 --timeout 60
  `);
}

// Main function
async function main() {
  const config = parseArgs();
  
  console.log('🚀 Starting PlayClone REST API Server...');
  console.log('Configuration:', config);
  
  try {
    const server = new RestApiServer(config);
    await server.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n⏹️ Shutting down server...');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n⏹️ Shutting down server...');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main();