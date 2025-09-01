#!/usr/bin/env node

const { PlayClone } = require('../dist/index');
const { CredentialManager } = require('../dist/security/CredentialManager');

console.log('🔐 PlayClone Credential Manager Example\n');

async function demonstrateCredentialManager() {
  // Initialize credential manager with secure passphrase
  // In production, this passphrase should come from environment variables or secure storage
  const credManager = new CredentialManager({
    encryptionKey: process.env.PLAYCLONE_MASTER_KEY || 'your-secure-passphrase-here'
  });

  await credManager.initialize();
  console.log('✅ Credential Manager initialized\n');

  // Example 1: Store GitHub credentials
  console.log('📝 Storing GitHub credentials...');
  const githubId = await credManager.addCredential({
    service: 'github.com',
    username: 'your-github-username',
    password: 'your-github-password', // Or use token instead
    metadata: {
      description: 'GitHub account for repository access',
      twoFactorEnabled: true
    }
  });
  console.log(`✅ GitHub credentials stored with ID: ${githubId}\n`);

  // Example 2: Store API token with expiration
  console.log('📝 Storing API token...');
  const apiId = await credManager.addCredential({
    service: 'api.example.com',
    username: 'api-key',
    token: 'sk-1234567890abcdef',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    metadata: {
      environment: 'production',
      permissions: ['read', 'write']
    }
  });
  console.log(`✅ API token stored with ID: ${apiId}\n`);

  // Example 3: Use credentials with PlayClone for automated login
  console.log('🌐 Using credentials for automated login...\n');
  
  const pc = new PlayClone({ headless: false });
  
  try {
    // Retrieve GitHub credentials
    const githubCreds = await credManager.getCredential(githubId);
    
    if (githubCreds) {
      console.log('📍 Navigating to GitHub login page...');
      await pc.navigate('https://github.com/login');
      
      console.log('🔑 Filling login form with stored credentials...');
      await pc.fill('Username or email input', githubCreds.username);
      await pc.fill('Password input', githubCreds.password || '');
      
      console.log('🖱️ Clicking sign in button...');
      await pc.click('Sign in button');
      
      // Wait for navigation or 2FA prompt
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Login attempted with stored credentials\n');
    }
  } catch (error) {
    console.log('⚠️ Login demonstration skipped (for safety)\n');
  }

  // Example 4: List all stored credentials
  console.log('📋 Listing all stored credentials:');
  const allCredentials = await credManager.listCredentials();
  
  allCredentials.forEach(cred => {
    console.log(`   - ${cred.service}: ${cred.username}`);
    console.log(`     ID: ${cred.id.substring(0, 8)}...`);
    console.log(`     Created: ${cred.createdAt.toISOString()}`);
    if (cred.expiresAt) {
      console.log(`     Expires: ${cred.expiresAt.toISOString()}`);
    }
  });
  console.log();

  // Example 5: Export credentials for backup
  console.log('💾 Exporting credentials for backup...');
  const exportPath = './credentials-backup.enc';
  await credManager.exportCredentials(exportPath, 'backup-password-123');
  console.log(`✅ Credentials exported to ${exportPath}\n`);

  // Example 6: Rotate encryption key for security
  console.log('🔄 Rotating encryption key...');
  await credManager.rotateEncryptionKey('new-even-more-secure-passphrase');
  console.log('✅ Encryption key rotated successfully\n');

  // Example 7: Find credentials by service
  console.log('🔍 Finding credentials for specific service...');
  const githubCredIds = await credManager.findCredentials('github.com');
  console.log(`Found ${githubCredIds.length} credential(s) for github.com\n`);

  // Example 8: Update existing credentials
  console.log('✏️ Updating API token...');
  await credManager.updateCredential(apiId, {
    token: 'sk-new-token-xyz',
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
  });
  console.log('✅ API token updated\n');

  // Example 9: Clean up demonstration credentials
  console.log('🧹 Cleaning up demonstration credentials...');
  await credManager.deleteAllCredentials();
  console.log('✅ All demonstration credentials deleted\n');

  // Close browser
  await pc.close();
  
  console.log('✨ Credential Manager demonstration complete!');
}

// Security best practices reminder
console.log('🔒 Security Best Practices:');
console.log('   1. Never hardcode credentials in source code');
console.log('   2. Use environment variables for master keys');
console.log('   3. Rotate encryption keys regularly');
console.log('   4. Set expiration dates for tokens');
console.log('   5. Use secure random passphrases');
console.log('   6. Store credential files with restricted permissions');
console.log('   7. Implement audit logging for credential access\n');

// Run demonstration
demonstrateCredentialManager().catch(console.error);