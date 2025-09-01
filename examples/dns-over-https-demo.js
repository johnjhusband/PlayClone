/**
 * DNS-over-HTTPS Demo
 * Demonstrates secure DNS resolution with PlayClone
 */

const { PlayClone } = require('../dist/index');

async function demoBasicDoH() {
  console.log('\n🔒 Basic DNS-over-HTTPS Demo');
  console.log('=' .repeat(50));
  
  // Create PlayClone instance with DoH enabled
  const pc = new PlayClone({
    headless: false, // Show browser for demo
    dnsOverHttps: {
      enabled: true,
      provider: 'cloudflare', // Use Cloudflare's DoH service
      cache: true, // Cache DNS responses
      fallbackToDNS: true // Fallback to regular DNS if DoH fails
    }
  });

  try {
    console.log('✅ Browser launched with DNS-over-HTTPS enabled');
    console.log('   Provider: Cloudflare (1.1.1.1)');
    console.log('   All DNS queries are now encrypted!');
    
    // Navigate to a website (DNS resolution happens securely)
    console.log('\n📍 Navigating to example.com...');
    await pc.navigate('https://example.com');
    console.log('✅ Page loaded using secure DNS resolution');
    
    // Extract some text to verify page loaded
    const text = await pc.getText('h1');
    console.log(`📝 Page title: ${text.data}`);
    
    // Navigate to another site
    console.log('\n📍 Navigating to github.com...');
    await pc.navigate('https://github.com');
    console.log('✅ GitHub loaded with secure DNS');
    
    // Wait a bit for demo visibility
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc.close();
    console.log('\n✅ Demo completed');
  }
}

async function demoMultipleProviders() {
  console.log('\n🔄 Multiple DoH Providers Demo');
  console.log('=' .repeat(50));
  
  const providers = [
    { name: 'Cloudflare', provider: 'cloudflare' },
    { name: 'Google', provider: 'google' },
    { name: 'Quad9', provider: 'quad9' },
    { name: 'AdGuard', provider: 'adguard' }
  ];
  
  for (const config of providers) {
    console.log(`\n🔍 Testing ${config.name} DoH...`);
    
    const pc = new PlayClone({
      headless: true,
      dnsOverHttps: {
        enabled: true,
        provider: config.provider,
        cache: false // Disable cache for testing
      }
    });
    
    try {
      const startTime = Date.now();
      await pc.navigate('https://www.cloudflare.com/dns/');
      const loadTime = Date.now() - startTime;
      
      console.log(`✅ ${config.name}: Page loaded in ${loadTime}ms`);
      
      // Get DNS manager to show provider details
      const dnsManager = pc.browserManager.getDnsManager();
      if (dnsManager) {
        const provider = dnsManager.getCurrentProvider();
        console.log(`   Server: ${provider.url}`);
        console.log(`   IPs: ${provider.ips.slice(0, 2).join(', ')}`);
      }
      
    } catch (error) {
      console.log(`❌ ${config.name}: Failed - ${error.message}`);
    } finally {
      await pc.close();
    }
  }
  
  console.log('\n✅ Provider comparison completed');
}

async function demoPrivacyFocused() {
  console.log('\n🛡️ Privacy-Focused Browsing Demo');
  console.log('=' .repeat(50));
  
  const pc = new PlayClone({
    headless: false,
    dnsOverHttps: {
      enabled: true,
      provider: 'quad9', // Quad9 blocks malicious domains
      cache: true,
      validateDNSSEC: true // Enable DNSSEC validation
    },
    // Additional privacy settings
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  try {
    console.log('🔐 Privacy-enhanced browser launched:');
    console.log('   ✓ DNS-over-HTTPS: Enabled (Quad9)');
    console.log('   ✓ DNSSEC Validation: Enabled');
    console.log('   ✓ Malicious Domain Blocking: Active');
    console.log('   ✓ DNS Query Encryption: Active');
    
    // Test with a privacy-focused search engine
    console.log('\n📍 Navigating to DuckDuckGo...');
    await pc.navigate('https://duckduckgo.com');
    
    // Perform a search
    console.log('🔍 Searching privately...');
    await pc.fill('input[type="text"]', 'DNS over HTTPS privacy');
    await pc.click('button[type="submit"]');
    
    // Wait for results
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Private search completed with encrypted DNS');
    
    // Show DNS stats
    const dnsManager = pc.browserManager.getDnsManager();
    if (dnsManager) {
      const stats = dnsManager.getStats();
      console.log('\n📊 DNS Statistics:');
      console.log(`   Provider: ${stats.provider}`);
      console.log(`   Cached entries: ${stats.cacheSize}`);
    }
    
    // Keep browser open for a moment
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc.close();
    console.log('\n✅ Privacy demo completed');
  }
}

async function demoDevelopmentMode() {
  console.log('\n🔧 Development Mode with DoH Demo');
  console.log('=' .repeat(50));
  
  const pc = new PlayClone({
    headless: false,
    devtools: true, // Open DevTools
    dnsOverHttps: {
      enabled: true,
      provider: 'cloudflare',
      cache: true
    }
  });
  
  try {
    console.log('🛠️ Developer browser launched:');
    console.log('   ✓ DevTools: Open');
    console.log('   ✓ DNS-over-HTTPS: Enabled');
    console.log('   ✓ Network inspection: Available');
    
    // Navigate to a test page
    await pc.navigate('https://httpbin.org/headers');
    
    console.log('\n💡 Check the Network tab in DevTools:');
    console.log('   - DNS queries are encrypted');
    console.log('   - No DNS lookups visible in network log');
    console.log('   - All resolution happens over HTTPS');
    
    // Test DNS resolution directly
    const dnsManager = pc.browserManager.getDnsManager();
    if (dnsManager) {
      console.log('\n🔍 Testing direct DNS resolution:');
      
      const addresses = await dnsManager.resolve('api.github.com', 'A');
      console.log(`   api.github.com → ${addresses[0]}`);
      
      const mx = await dnsManager.resolve('google.com', 'MX');
      console.log(`   google.com MX → ${mx[0]}`);
    }
    
    // Keep browser open for inspection
    console.log('\n⏸️ Browser will stay open for 5 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc.close();
    console.log('\n✅ Development demo completed');
  }
}

// Main demo runner
async function runDemo() {
  console.log('🚀 PlayClone DNS-over-HTTPS Demo Suite');
  console.log('=' .repeat(50));
  
  const demos = [
    { name: 'Basic DoH', fn: demoBasicDoH },
    { name: 'Multiple Providers', fn: demoMultipleProviders },
    { name: 'Privacy-Focused', fn: demoPrivacyFocused },
    { name: 'Development Mode', fn: demoDevelopmentMode }
  ];
  
  // Check command line argument for specific demo
  const demoArg = process.argv[2];
  
  if (demoArg) {
    const demoIndex = parseInt(demoArg) - 1;
    if (demoIndex >= 0 && demoIndex < demos.length) {
      console.log(`\nRunning demo ${demoIndex + 1}: ${demos[demoIndex].name}`);
      await demos[demoIndex].fn();
    } else {
      console.log('\nAvailable demos:');
      demos.forEach((demo, i) => {
        console.log(`  ${i + 1}. ${demo.name}`);
      });
      console.log('\nUsage: node dns-over-https-demo.js [demo-number]');
    }
  } else {
    // Run all demos
    for (let i = 0; i < demos.length; i++) {
      console.log(`\n[${i + 1}/${demos.length}] Running: ${demos[i].name}`);
      await demos[i].fn();
      
      if (i < demos.length - 1) {
        console.log('\n⏸️ Pausing before next demo...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 All DNS-over-HTTPS demos completed!');
    console.log('\n💡 Key Benefits of DNS-over-HTTPS:');
    console.log('   ✓ Encrypts DNS queries for privacy');
    console.log('   ✓ Prevents DNS spoofing and hijacking');
    console.log('   ✓ Bypasses DNS-based censorship');
    console.log('   ✓ Protects against ISP snooping');
    console.log('   ✓ Improves security on public WiFi');
  }
}

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { 
  demoBasicDoH, 
  demoMultipleProviders, 
  demoPrivacyFocused,
  demoDevelopmentMode 
};