#!/usr/bin/env node

const { CredentialManager } = require('../dist/security/CredentialManager');
const fs = require('fs');
const path = require('path');

console.log('🔐 Testing PlayClone Credential Manager\n');

async function runTests() {
  const testDir = path.join(process.cwd(), '.test-credentials');
  
  // Clean up test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }

  const manager = new CredentialManager({
    storagePath: path.join(testDir, 'credentials.enc'),
    encryptionKey: 'test-passphrase-12345'
  });

  const results = [];

  try {
    // Test 1: Initialize manager
    console.log('Test 1: Initializing credential manager...');
    await manager.initialize();
    results.push({ test: 'Initialize', status: '✅' });
    console.log('✅ Initialized successfully\n');

    // Test 2: Add credential with password
    console.log('Test 2: Adding credential with password...');
    const credId1 = await manager.addCredential({
      service: 'github.com',
      username: 'testuser',
      password: 'supersecret123',
      metadata: { description: 'GitHub account' }
    });
    results.push({ test: 'Add credential', status: '✅', id: credId1 });
    console.log(`✅ Added credential: ${credId1}\n`);

    // Test 3: Add credential with token
    console.log('Test 3: Adding credential with token...');
    const credId2 = await manager.addCredential({
      service: 'api.service.com',
      username: 'api-user',
      token: 'token-xyz-789',
      metadata: { api_version: 'v2' },
      expiresAt: new Date(Date.now() + 86400000) // Expires in 24 hours
    });
    results.push({ test: 'Add token credential', status: '✅', id: credId2 });
    console.log(`✅ Added token credential: ${credId2}\n`);

    // Test 4: Retrieve credential
    console.log('Test 4: Retrieving credential...');
    const retrieved = await manager.getCredential(credId1);
    if (retrieved && retrieved.password === 'supersecret123') {
      results.push({ test: 'Retrieve credential', status: '✅' });
      console.log('✅ Retrieved credential successfully');
      console.log(`   Service: ${retrieved.service}`);
      console.log(`   Username: ${retrieved.username}\n`);
    } else {
      results.push({ test: 'Retrieve credential', status: '❌' });
      console.log('❌ Failed to retrieve credential\n');
    }

    // Test 5: Find credentials by service
    console.log('Test 5: Finding credentials by service...');
    const githubCreds = await manager.findCredentials('github.com');
    if (githubCreds.length === 1 && githubCreds[0] === credId1) {
      results.push({ test: 'Find by service', status: '✅' });
      console.log(`✅ Found ${githubCreds.length} GitHub credential(s)\n`);
    } else {
      results.push({ test: 'Find by service', status: '❌' });
      console.log('❌ Failed to find credentials\n');
    }

    // Test 6: Update credential
    console.log('Test 6: Updating credential...');
    const updated = await manager.updateCredential(credId1, {
      password: 'newsecret456',
      metadata: { description: 'Updated GitHub account' }
    });
    if (updated) {
      const updatedCred = await manager.getCredential(credId1);
      if (updatedCred && updatedCred.password === 'newsecret456') {
        results.push({ test: 'Update credential', status: '✅' });
        console.log('✅ Updated credential successfully\n');
      } else {
        results.push({ test: 'Update credential', status: '❌' });
        console.log('❌ Failed to update credential\n');
      }
    }

    // Test 7: List all credentials
    console.log('Test 7: Listing all credentials...');
    const allCreds = await manager.listCredentials();
    if (allCreds.length === 2) {
      results.push({ test: 'List credentials', status: '✅' });
      console.log(`✅ Listed ${allCreds.length} credentials:`);
      allCreds.forEach(cred => {
        console.log(`   - ${cred.service}: ${cred.username} (ID: ${cred.id.substring(0, 8)}...)`);
      });
      console.log();
    } else {
      results.push({ test: 'List credentials', status: '❌' });
      console.log('❌ Failed to list credentials\n');
    }

    // Test 8: Export credentials
    console.log('Test 8: Exporting credentials...');
    const exportPath = path.join(testDir, 'export.enc');
    await manager.exportCredentials(exportPath, 'export-password');
    if (fs.existsSync(exportPath)) {
      results.push({ test: 'Export credentials', status: '✅' });
      console.log(`✅ Exported to ${exportPath}\n`);
    } else {
      results.push({ test: 'Export credentials', status: '❌' });
      console.log('❌ Failed to export credentials\n');
    }

    // Test 9: Import credentials
    console.log('Test 9: Importing credentials...');
    const manager2 = new CredentialManager({
      storagePath: path.join(testDir, 'credentials2.enc'),
      encryptionKey: 'different-passphrase'
    });
    await manager2.initialize();
    await manager2.importCredentials(exportPath, 'export-password', false);
    const importedList = await manager2.listCredentials();
    if (importedList.length === 2) {
      results.push({ test: 'Import credentials', status: '✅' });
      console.log('✅ Imported credentials successfully\n');
    } else {
      results.push({ test: 'Import credentials', status: '❌' });
      console.log('❌ Failed to import credentials\n');
    }

    // Test 10: Delete credential
    console.log('Test 10: Deleting credential...');
    const deleted = await manager.deleteCredential(credId2);
    if (deleted) {
      const afterDelete = await manager.listCredentials();
      if (afterDelete.length === 1) {
        results.push({ test: 'Delete credential', status: '✅' });
        console.log('✅ Deleted credential successfully\n');
      } else {
        results.push({ test: 'Delete credential', status: '❌' });
        console.log('❌ Failed to delete credential\n');
      }
    }

    // Test 11: Rotate encryption key
    console.log('Test 11: Rotating encryption key...');
    await manager.rotateEncryptionKey('new-secure-passphrase');
    const afterRotation = await manager.getCredential(credId1);
    if (afterRotation && afterRotation.password === 'newsecret456') {
      results.push({ test: 'Rotate encryption key', status: '✅' });
      console.log('✅ Rotated encryption key successfully\n');
    } else {
      results.push({ test: 'Rotate encryption key', status: '❌' });
      console.log('❌ Failed to rotate encryption key\n');
    }

    // Test 12: Delete all credentials
    console.log('Test 12: Deleting all credentials...');
    await manager.deleteAllCredentials();
    const afterDeleteAll = await manager.listCredentials();
    if (afterDeleteAll.length === 0) {
      results.push({ test: 'Delete all', status: '✅' });
      console.log('✅ Deleted all credentials successfully\n');
    } else {
      results.push({ test: 'Delete all', status: '❌' });
      console.log('❌ Failed to delete all credentials\n');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    results.push({ test: 'Error occurred', status: '❌', error: error.message });
  } finally {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }

  // Print summary
  console.log('═'.repeat(50));
  console.log('📊 Test Summary:\n');
  
  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  
  results.forEach(r => {
    console.log(`${r.status} ${r.test}${r.id ? ` (${r.id.substring(0, 8)}...)` : ''}`);
  });
  
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`📈 Success Rate: ${Math.round(passed / results.length * 100)}%`);
  
  if (passed === results.length) {
    console.log('\n🎉 All credential manager tests passed!');
  }
}

// Run tests
runTests().catch(console.error);