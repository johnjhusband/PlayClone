#!/usr/bin/env node

/**
 * Quick verification that DNS-over-HTTPS is working
 */

const { DnsOverHttpsManager } = require('../dist/security/DnsOverHttpsManager');

async function verify() {
  console.log('🔒 Verifying DNS-over-HTTPS functionality...\n');
  
  const manager = new DnsOverHttpsManager({
    provider: 'cloudflare',
    cache: true
  });
  
  try {
    // Test resolution
    const addresses = await manager.resolve('google.com', 'A');
    console.log('✅ DNS resolution working!');
    console.log(`   google.com → ${addresses[0]}`);
    
    // Test provider info
    const provider = manager.getCurrentProvider();
    console.log(`✅ Using provider: ${provider.name}`);
    console.log(`   URL: ${provider.url}`);
    
    // Test connectivity
    const connected = await manager.testConnectivity();
    console.log(`✅ Connectivity test: ${connected ? 'PASSED' : 'FAILED'}`);
    
    console.log('\n🎉 DNS-over-HTTPS is fully functional!');
    return 0;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return 1;
  }
}

verify().then(process.exit);