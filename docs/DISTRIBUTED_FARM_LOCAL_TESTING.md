# Distributed Browser Farm Local Testing Guide

## Overview

PlayClone v1.4.0 introduces enhanced local testing capabilities for the distributed browser farm feature. The new `LocalBrowserFarmTester` class allows developers to test multi-node distributed scenarios without requiring actual remote servers or complex infrastructure setup.

## Key Features

### 🎯 Local Node Simulation
- Simulate multiple browser farm nodes locally on different ports
- Each node runs independently with its own WebSocket server
- Configurable capacity, region, and performance characteristics per node

### 🌐 Network Condition Simulation
- Simulated network latency (configurable per node)
- Failure rate simulation for testing resilience
- Packet loss and jitter simulation
- Bandwidth throttling capabilities

### ⚖️ Load Balancing Testing
- Test all load balancing strategies locally
- Verify session distribution across nodes
- Validate session affinity and sticky sessions
- Monitor load distribution metrics

### 🔥 Chaos Engineering
- Simulate node failures and recoveries
- Test failover mechanisms
- Validate session migration
- Measure system resilience

### 📊 Performance Testing
- High load simulation
- Concurrent session testing
- Resource utilization monitoring
- Bottleneck identification

## Quick Start

### Basic Usage

```javascript
const { LocalBrowserFarmTester } = require('playclone');

// Configure local test nodes
const testConfig = {
  nodes: [
    {
      id: 'node-1',
      region: 'us-east',
      capacity: 5,
      simulatedLatency: 20,
      simulatedFailureRate: 0
    },
    {
      id: 'node-2',
      region: 'us-west',
      capacity: 3,
      simulatedLatency: 50,
      simulatedFailureRate: 0.05 // 5% failure rate
    }
  ],
  basePort: 9000,
  simulateNetworkConditions: true,
  autoStart: true
};

// Initialize tester
const tester = new LocalBrowserFarmTester(testConfig);
await tester.initialize();

// Create distributed farm from local nodes
const farm = await tester.createDistributedFarm();

// Run tests
const sessionId = await farm.createSession({ userId: 'test-user' });
await farm.executeAction(sessionId, 'navigate', { url: 'https://example.com' });

// Cleanup
await tester.cleanup();
```

### Advanced Testing

```javascript
// Simulate node failures
await tester.simulateNodeFailure('node-1');
// ... test failover behavior ...
await tester.simulateNodeRecovery('node-1');

// High load simulation
await tester.simulateHighLoad(30000); // 30 seconds

// Chaos engineering test
const chaosResults = await tester.runChaosTest({
  duration: 60000,      // 1 minute
  failureRate: 0.3,     // 30% chance of node failure
  recoveryDelay: 5000   // 5 seconds to recover
});

// Get metrics
const metrics = tester.getMetrics();
console.log(`Utilization: ${metrics.summary.utilization}%`);
```

## Configuration Options

### LocalTestConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `nodes` | `LocalNodeConfig[]` | Required | Array of node configurations |
| `basePort` | `number` | 9000 | Starting port for local nodes |
| `simulateNetworkConditions` | `boolean` | false | Enable network simulation |
| `autoStart` | `boolean` | true | Start nodes automatically |
| `verbose` | `boolean` | false | Enable verbose logging |

### LocalNodeConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `string` | Required | Unique node identifier |
| `port` | `number` | Auto | Port for WebSocket server |
| `region` | `string` | Required | Simulated region |
| `capacity` | `number` | Required | Max concurrent sessions |
| `weight` | `number` | 1 | Load balancing weight |
| `simulatedLatency` | `number` | 0 | Latency in milliseconds |
| `simulatedFailureRate` | `number` | 0 | Failure probability (0-1) |

## Testing Scenarios

### 1. Load Balancing Verification

```javascript
// Test different strategies
const strategies = ['round-robin', 'least-connections', 'weighted', 'latency-based'];

for (const strategy of strategies) {
  const farm = await tester.createDistributedFarm({ loadBalancing: strategy });
  
  // Create many sessions
  for (let i = 0; i < 20; i++) {
    await farm.createSession({ userId: `user-${i}` });
  }
  
  // Verify distribution
  const metrics = farm.getMetrics();
  console.log(`Strategy: ${strategy}, Distribution:`, metrics.nodeMetrics);
}
```

### 2. Failover Testing

```javascript
// Create sessions on specific node
const sessions = [];
for (let i = 0; i < 5; i++) {
  sessions.push(await farm.createSession({ userId: 'test' }));
}

// Simulate node failure
await tester.simulateNodeFailure('node-1');

// Verify sessions migrated
await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for migration

// Check sessions are still accessible
for (const sessionId of sessions) {
  const result = await farm.executeAction(sessionId, 'getText', { selector: 'body' });
  console.assert(result.success, 'Session should still be accessible');
}
```

### 3. Performance Testing

```javascript
// Measure latency under load
const startTime = Date.now();
const operations = [];

for (let i = 0; i < 100; i++) {
  operations.push(
    farm.createSession({ userId: `perf-test-${i}` })
      .then(sessionId => farm.executeAction(sessionId, 'navigate', { url: 'https://example.com' }))
  );
}

await Promise.all(operations);
const duration = Date.now() - startTime;

console.log(`Completed 100 operations in ${duration}ms`);
console.log(`Average: ${duration / 100}ms per operation`);
```

### 4. Chaos Engineering

```javascript
// Run comprehensive chaos test
const chaosResults = await tester.runChaosTest({
  duration: 300000,     // 5 minutes
  failureRate: 0.2,     // 20% failure rate
  recoveryDelay: 10000  // 10 seconds recovery
});

// Analyze results
const resilienceScore = (chaosResults.totalRecoveries / chaosResults.totalFailures) * 100;
console.log(`Resilience Score: ${resilienceScore.toFixed(1)}%`);
console.log(`Sessions Lost: ${chaosResults.errors}`);
console.log(`Average Recovery Time: ${chaosResults.recoveryDelay}ms`);
```

## Event Monitoring

The LocalBrowserFarmTester emits various events for monitoring:

```javascript
tester.on('nodeStarted', ({ id, port }) => {
  console.log(`Node ${id} started on port ${port}`);
});

tester.on('nodeFailureSimulated', ({ nodeId }) => {
  console.log(`Node ${nodeId} failed`);
});

tester.on('sessionCreated', ({ sessionId, nodeId }) => {
  console.log(`Session ${sessionId} created on ${nodeId}`);
});

tester.on('highLoadCompleted', ({ sessionCount }) => {
  console.log(`High load test completed: ${sessionCount} sessions`);
});

tester.on('chaosTestCompleted', (results) => {
  console.log('Chaos test results:', results);
});
```

## Metrics and Monitoring

```javascript
// Get comprehensive metrics
const metrics = tester.getMetrics();

console.log('Node Metrics:');
metrics.nodes.forEach(node => {
  console.log(`  ${node.id}:`);
  console.log(`    • Health: ${node.healthy ? '✅' : '❌'}`);
  console.log(`    • Sessions: ${node.sessions}/${node.capacity}`);
  console.log(`    • Requests: ${node.metrics.requestCount}`);
  console.log(`    • Errors: ${node.metrics.errorCount}`);
  console.log(`    • Avg Latency: ${node.metrics.averageLatency}ms`);
});

console.log('\nSummary:');
console.log(`  • Total Capacity: ${metrics.summary.totalCapacity}`);
console.log(`  • Active Sessions: ${metrics.summary.totalSessions}`);
console.log(`  • Utilization: ${metrics.summary.utilization.toFixed(1)}%`);
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Distributed Farm Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Run distributed farm tests
        run: node tests/distributed-farm-local-test.js
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: farm-test-results
          path: test-results/
```

### Jenkins Pipeline Example

```groovy
pipeline {
  agent any
  
  stages {
    stage('Setup') {
      steps {
        sh 'npm install'
        sh 'npm run build'
      }
    }
    
    stage('Local Farm Tests') {
      steps {
        sh 'node tests/distributed-farm-local-test.js'
      }
    }
    
    stage('Chaos Testing') {
      steps {
        script {
          def tester = load 'tests/chaos-test.js'
          def results = tester.runChaosTest()
          if (results.resilienceScore < 80) {
            error("Resilience score too low: ${results.resilienceScore}%")
          }
        }
      }
    }
  }
}
```

## Best Practices

### 1. Resource Management
- Always call `cleanup()` after tests to free resources
- Limit concurrent nodes based on available system resources
- Use reasonable capacity values for local testing

### 2. Test Isolation
- Create new tester instances for each test suite
- Clean up sessions between tests
- Reset node states after failure simulations

### 3. Realistic Simulation
- Match production latency values
- Use realistic failure rates (typically 1-5%)
- Test with production-like load patterns

### 4. Monitoring
- Log all important events
- Track metrics over time
- Set up alerts for anomalies

## Troubleshooting

### Common Issues

**Issue**: Nodes fail to start
```javascript
// Solution: Check port availability
const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });
};

// Use available ports
const basePort = 9000;
for (let i = 0; i < 10; i++) {
  if (await isPortAvailable(basePort + i)) {
    config.basePort = basePort + i;
    break;
  }
}
```

**Issue**: High memory usage
```javascript
// Solution: Limit concurrent sessions and implement cleanup
const MAX_CONCURRENT = 10;
const sessions = [];

for (let i = 0; i < 100; i++) {
  if (sessions.length >= MAX_CONCURRENT) {
    const oldSession = sessions.shift();
    await farm.closeSession(oldSession);
  }
  
  const sessionId = await farm.createSession({ userId: `user-${i}` });
  sessions.push(sessionId);
}
```

**Issue**: Flaky tests
```javascript
// Solution: Add retries and proper waits
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Use with tests
await withRetry(async () => {
  const result = await farm.executeAction(sessionId, 'click', { selector: 'button' });
  assert(result.success);
});
```

## API Reference

### LocalBrowserFarmTester

#### Constructor
```typescript
new LocalBrowserFarmTester(config: LocalTestConfig)
```

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `initialize()` | `Promise<void>` | Initialize all local nodes |
| `startAllNodes()` | `Promise<void>` | Start all configured nodes |
| `stopAllNodes()` | `Promise<void>` | Stop all running nodes |
| `createDistributedFarm()` | `Promise<DistributedBrowserFarm>` | Create farm from local nodes |
| `simulateNodeFailure(nodeId)` | `Promise<void>` | Simulate node failure |
| `simulateNodeRecovery(nodeId)` | `Promise<void>` | Simulate node recovery |
| `simulateHighLoad(duration)` | `Promise<void>` | Run high load test |
| `runChaosTest(options)` | `Promise<ChaosResults>` | Run chaos engineering test |
| `getMetrics()` | `MetricsSummary` | Get current metrics |
| `cleanup()` | `Promise<void>` | Clean up all resources |

## Conclusion

The LocalBrowserFarmTester provides a powerful way to test distributed browser farm scenarios locally without complex infrastructure. It enables developers to:

- Validate load balancing strategies
- Test failover and recovery mechanisms
- Simulate real-world network conditions
- Perform chaos engineering tests
- Measure performance under load

This makes it easier to develop, test, and debug distributed browser automation at scale.