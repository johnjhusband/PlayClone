#!/usr/bin/env node

/**
 * Browser Farm Example
 * 
 * This example demonstrates how to use PlayClone's distributed browser farm
 * for scaling automation across multiple machines.
 */

const { BrowserFarm, BrowserFarmClient } = require('../dist/index');

// Configuration for the farm server
const farmConfig = {
  port: 8080,
  maxSessionsPerWorker: 5,
  healthCheckInterval: 30000,
  sessionTimeout: 300000,
  loadBalancingStrategy: 'least-connections',
  authentication: {
    type: 'token',
    secret: 'your-secret-token-here'
  }
};

// Start the browser farm server
async function startFarmServer() {
  console.log('🚀 Starting browser farm server...');
  
  const farm = new BrowserFarm(farmConfig);
  
  // Listen for farm events
  farm.on('started', (info) => {
    console.log(`✅ Farm started on port ${info.port} with ${info.workers} workers`);
  });
  
  farm.on('workerAdded', (worker) => {
    console.log(`➕ Worker added: ${worker.id} at ${worker.host}:${worker.port}`);
  });
  
  farm.on('sessionCreated', (session) => {
    console.log(`📱 Session created: ${session.sessionId} on worker ${session.workerId}`);
  });
  
  farm.on('sessionClosed', (session) => {
    console.log(`📴 Session closed: ${session.sessionId}`);
  });
  
  // Start the farm
  await farm.start();
  
  // Add remote workers (if any)
  // await farm.addWorker({
  //   host: 'worker1.example.com',
  //   port: 8081,
  //   capacity: 10
  // });
  
  // Get farm status
  const status = farm.getStatus();
  console.log('\n📊 Farm Status:');
  console.log(`  Total Workers: ${status.totalWorkers}`);
  console.log(`  Online Workers: ${status.onlineWorkers}`);
  console.log(`  Active Sessions: ${status.activeSessions}`);
  console.log(`  Load Balancing: ${status.loadBalancing}`);
  
  return farm;
}

// Client example - connect to farm and run automation
async function runClientExample() {
  console.log('\n🔌 Connecting to browser farm as client...');
  
  const client = new BrowserFarmClient({
    url: 'http://localhost:8080',
    authentication: {
      type: 'token',
      secret: 'your-secret-token-here'
    },
    reconnect: true,
    timeout: 30000
  });
  
  // Connect to farm
  await client.connect();
  console.log('✅ Connected to farm');
  
  // Create a new browser session
  console.log('\n🌐 Creating browser session...');
  const sessionId = await client.createSession({
    browser: 'chromium',
    headless: false,
    viewport: { width: 1280, height: 720 }
  });
  console.log(`✅ Session created: ${sessionId}`);
  
  // Navigate to a website
  console.log('\n📍 Navigating to example.com...');
  await client.navigate(sessionId, 'https://example.com');
  console.log('✅ Navigation complete');
  
  // Extract text
  console.log('\n📄 Extracting page text...');
  const text = await client.getText(sessionId, 'h1');
  console.log(`✅ Found heading: ${text}`);
  
  // Take a screenshot
  console.log('\n📸 Taking screenshot...');
  const screenshot = await client.screenshot(sessionId, { fullPage: true });
  console.log(`✅ Screenshot captured (${screenshot.length} bytes)`);
  
  // Get farm status
  console.log('\n📊 Getting farm status...');
  const status = await client.getStatus();
  console.log('Farm status:', JSON.stringify(status, null, 2));
  
  // Close session
  console.log('\n🔚 Closing session...');
  await client.closeSession(sessionId);
  console.log('✅ Session closed');
  
  // Disconnect
  await client.disconnect();
  console.log('✅ Disconnected from farm');
}

// Parallel execution example
async function runParallelExample(client) {
  console.log('\n🚀 Running parallel automation on multiple workers...');
  
  const urls = [
    'https://example.com',
    'https://google.com',
    'https://github.com',
    'https://stackoverflow.com',
    'https://nodejs.org'
  ];
  
  // Create sessions for each URL
  const sessions = await Promise.all(
    urls.map(async (url) => {
      const sessionId = await client.createSession({
        browser: 'chromium',
        headless: true
      });
      return { sessionId, url };
    })
  );
  
  console.log(`✅ Created ${sessions.length} sessions`);
  
  // Navigate all sessions in parallel
  const results = await Promise.all(
    sessions.map(async ({ sessionId, url }) => {
      try {
        await client.navigate(sessionId, url);
        const title = await client.getText(sessionId, 'title');
        return { url, title, success: true };
      } catch (error) {
        return { url, error: error.message, success: false };
      }
    })
  );
  
  // Display results
  console.log('\n📊 Results:');
  results.forEach(result => {
    if (result.success) {
      console.log(`  ✅ ${result.url}: ${result.title}`);
    } else {
      console.log(`  ❌ ${result.url}: ${result.error}`);
    }
  });
  
  // Close all sessions
  await Promise.all(
    sessions.map(({ sessionId }) => client.closeSession(sessionId))
  );
  
  console.log('✅ All sessions closed');
}

// Load testing example
async function runLoadTest(client) {
  console.log('\n🔥 Running load test...');
  
  const concurrency = 20;
  const iterations = 100;
  const results = [];
  
  console.log(`  Concurrency: ${concurrency}`);
  console.log(`  Total iterations: ${iterations}`);
  
  const startTime = Date.now();
  
  // Run iterations in batches
  for (let i = 0; i < iterations; i += concurrency) {
    const batch = Math.min(concurrency, iterations - i);
    
    const batchResults = await Promise.all(
      Array(batch).fill(0).map(async () => {
        const opStart = Date.now();
        
        try {
          const sessionId = await client.createSession({ headless: true });
          await client.navigate(sessionId, 'https://example.com');
          await client.getText(sessionId, 'h1');
          await client.closeSession(sessionId);
          
          return {
            success: true,
            duration: Date.now() - opStart
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            duration: Date.now() - opStart
          };
        }
      })
    );
    
    results.push(...batchResults);
    console.log(`  Progress: ${results.length}/${iterations}`);
  }
  
  const totalTime = Date.now() - startTime;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log('\n📊 Load Test Results:');
  console.log(`  Total Time: ${totalTime}ms`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Success Rate: ${(successful / iterations * 100).toFixed(2)}%`);
  console.log(`  Average Duration: ${avgDuration.toFixed(2)}ms`);
  console.log(`  Operations/sec: ${(iterations / (totalTime / 1000)).toFixed(2)}`);
}

// Main execution
async function main() {
  console.log('🎯 PlayClone Browser Farm Example');
  console.log('==================================\n');
  
  let farm;
  
  try {
    // Start farm server
    farm = await startFarmServer();
    
    // Wait a moment for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Run client example
    await runClientExample();
    
    // Create a client for additional examples
    const client = new BrowserFarmClient({
      url: 'http://localhost:8080',
      authentication: {
        type: 'token',
        secret: 'your-secret-token-here'
      }
    });
    
    await client.connect();
    
    // Run parallel example
    await runParallelExample(client);
    
    // Run load test
    await runLoadTest(client);
    
    await client.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Stop the farm
    if (farm) {
      console.log('\n🛑 Stopping browser farm...');
      await farm.stop();
      console.log('✅ Farm stopped');
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { startFarmServer, BrowserFarmClient };