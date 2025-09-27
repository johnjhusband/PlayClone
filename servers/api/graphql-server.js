#!/usr/bin/env node

/**
 * PlayClone GraphQL API Server
 * 
 * A standalone GraphQL server providing full browser automation capabilities
 * through a GraphQL interface with queries, mutations, and subscriptions.
 * 
 * Usage:
 *   node graphql-server.js [options]
 * 
 * Options:
 *   --port, -p       Port to listen on (default: 4000)
 *   --host, -h       Host to bind to (default: localhost)
 *   --max-sessions   Maximum concurrent sessions (default: 10)
 *   --timeout        Session timeout in minutes (default: 30)
 *   --no-playground  Disable GraphQL Playground
 * 
 * Examples:
 *   node graphql-server.js
 *   node graphql-server.js --port 5000 --host 0.0.0.0
 *   node graphql-server.js --max-sessions 20 --timeout 60
 * 
 * Environment Variables:
 *   GRAPHQL_PORT         Port number (overrides --port)
 *   GRAPHQL_HOST         Host address (overrides --host)
 *   GRAPHQL_MAX_SESSIONS Maximum sessions (overrides --max-sessions)
 *   GRAPHQL_TIMEOUT      Session timeout (overrides --timeout)
 */

const { GraphQLApiServer } = require('./dist/server/GraphQLApiServer');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    port: parseInt(process.env.GRAPHQL_PORT || '4000'),
    host: process.env.GRAPHQL_HOST || 'localhost',
    maxSessions: parseInt(process.env.GRAPHQL_MAX_SESSIONS || '10'),
    sessionTimeout: parseInt(process.env.GRAPHQL_TIMEOUT || '30'),
    playground: true
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    
    switch (arg) {
      case '--port':
      case '-p':
        config.port = parseInt(next);
        i++;
        break;
      
      case '--host':
      case '-h':
        config.host = next;
        i++;
        break;
      
      case '--max-sessions':
        config.maxSessions = parseInt(next);
        i++;
        break;
      
      case '--timeout':
        config.sessionTimeout = parseInt(next);
        i++;
        break;
      
      case '--no-playground':
        config.playground = false;
        break;
      
      case '--help':
        console.log(`
PlayClone GraphQL API Server

Usage:
  node graphql-server.js [options]

Options:
  --port, -p       Port to listen on (default: 4000)
  --host, -h       Host to bind to (default: localhost)
  --max-sessions   Maximum concurrent sessions (default: 10)
  --timeout        Session timeout in minutes (default: 30)
  --no-playground  Disable GraphQL Playground
  --help           Show this help message

Examples:
  node graphql-server.js
  node graphql-server.js --port 5000 --host 0.0.0.0
  node graphql-server.js --max-sessions 20 --timeout 60

Environment Variables:
  GRAPHQL_PORT         Port number
  GRAPHQL_HOST         Host address
  GRAPHQL_MAX_SESSIONS Maximum sessions
  GRAPHQL_TIMEOUT      Session timeout
        `);
        process.exit(0);
    }
  }
  
  return config;
}

// Main function
async function main() {
  const config = parseArgs();
  
  console.log('Starting PlayClone GraphQL API Server...');
  console.log('Configuration:', config);
  
  // Create and start server
  const server = new GraphQLApiServer(config);
  
  try {
    await server.start();
    
    console.log(`
GraphQL API Server is running!

🚀 GraphQL Endpoint: http://${config.host}:${config.port}/graphql
🔌 WebSocket Endpoint: ws://${config.host}:${config.port}/graphql
${config.playground ? `🎮 GraphQL Playground: http://${config.host}:${config.port}/graphql` : ''}

Configuration:
  Max Sessions: ${config.maxSessions}
  Session Timeout: ${config.sessionTimeout} minutes
  Playground: ${config.playground ? 'Enabled' : 'Disabled'}

Press Ctrl+C to stop the server
    `);
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down GraphQL server...');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\nShutting down GraphQL server...');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start GraphQL server:', error);
    process.exit(1);
  }
}

// Run the server
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});