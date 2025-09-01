#!/usr/bin/env node

const { AuditLogger, AuditEventType, AuditSeverity } = require('../dist/security/AuditLogger');
const fs = require('fs');
const path = require('path');

console.log('📋 Testing PlayClone Audit Logger\n');

async function runTests() {
  const testDir = path.join(process.cwd(), '.test-audit');
  
  // Clean up test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }

  const logger = new AuditLogger({
    logPath: testDir,
    enableConsole: false,
    enableFile: true,
    redactSensitiveData: true,
    complianceMode: 'SOC2'
  });

  const results = [];

  try {
    // Test 1: Log system start
    console.log('Test 1: Logging system start event...');
    await logger.log(AuditEventType.SYSTEM_START, 'System initialized', {
      metadata: { version: '1.1.0', environment: 'test' }
    });
    results.push({ test: 'System start log', status: '✅' });
    console.log('✅ Logged system start\n');

    // Test 2: Log browser launch
    console.log('Test 2: Logging browser launch...');
    await logger.log(AuditEventType.BROWSER_LAUNCHED, 'Chromium browser launched', {
      sessionId: 'session-123',
      resource: 'chromium',
      result: 'SUCCESS',
      additionalData: { headless: false, viewport: '1920x1080' }
    });
    results.push({ test: 'Browser launch log', status: '✅' });
    console.log('✅ Logged browser launch\n');

    // Test 3: Log login attempt
    console.log('Test 3: Logging login attempt...');
    await logger.log(AuditEventType.LOGIN_ATTEMPT, 'User login attempted', {
      userId: 'user-456',
      resource: 'github.com',
      metadata: { ip: '192.168.1.1', userAgent: 'Chrome/120.0' }
    });
    results.push({ test: 'Login attempt log', status: '✅' });
    console.log('✅ Logged login attempt\n');

    // Test 4: Log login success
    console.log('Test 4: Logging login success...');
    await logger.log(AuditEventType.LOGIN_SUCCESS, 'User login successful', {
      userId: 'user-456',
      sessionId: 'session-789',
      resource: 'github.com',
      result: 'SUCCESS'
    });
    results.push({ test: 'Login success log', status: '✅' });
    console.log('✅ Logged login success\n');

    // Test 5: Log credential access with sensitive data
    console.log('Test 5: Logging credential access (testing redaction)...');
    await logger.log(AuditEventType.CREDENTIAL_ACCESSED, 'Credential retrieved', {
      userId: 'user-456',
      resource: 'github-credentials',
      additionalData: {
        username: 'testuser',
        password: 'secret123', // Should be redacted
        apiKey: 'sk-12345',    // Should be redacted
        description: 'GitHub account'
      }
    });
    results.push({ test: 'Credential access log', status: '✅' });
    console.log('✅ Logged credential access (sensitive data redacted)\n');

    // Test 6: Log security violation
    console.log('Test 6: Logging security violation...');
    await logger.log(AuditEventType.SECURITY_VIOLATION, 'Unauthorized access attempt', {
      severity: AuditSeverity.CRITICAL,
      resource: '/admin/users',
      result: 'FAILURE',
      error: 'Permission denied: insufficient privileges'
    });
    results.push({ test: 'Security violation log', status: '✅' });
    console.log('✅ Logged security violation\n');

    // Test 7: Log data extraction
    console.log('Test 7: Logging data extraction...');
    await logger.log(AuditEventType.DATA_EXTRACTED, 'Table data extracted', {
      sessionId: 'session-123',
      resource: 'https://example.com/data',
      result: 'SUCCESS',
      additionalData: { rowCount: 100, format: 'json' }
    });
    results.push({ test: 'Data extraction log', status: '✅' });
    console.log('✅ Logged data extraction\n');

    // Test 8: Query logs
    console.log('Test 8: Querying audit logs...');
    const queryResults = await logger.query({
      types: [AuditEventType.LOGIN_SUCCESS, AuditEventType.LOGIN_ATTEMPT],
      userId: 'user-456'
    });
    
    if (queryResults.length === 2) {
      results.push({ test: 'Query logs', status: '✅' });
      console.log(`✅ Found ${queryResults.length} matching events\n`);
    } else {
      results.push({ test: 'Query logs', status: '❌' });
      console.log(`❌ Expected 2 events, found ${queryResults.length}\n`);
    }

    // Test 9: Generate report
    console.log('Test 9: Generating audit report...');
    const report = await logger.generateReport({
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(),
      format: 'json'
    });
    
    const reportData = JSON.parse(report);
    if (reportData.length >= 7) {
      results.push({ test: 'Generate report', status: '✅' });
      console.log(`✅ Generated report with ${reportData.length} events\n`);
    } else {
      results.push({ test: 'Generate report', status: '❌' });
      console.log(`❌ Report has ${reportData.length} events, expected at least 7\n`);
    }

    // Test 10: Verify log file creation
    console.log('Test 10: Verifying log file creation...');
    const logFiles = fs.readdirSync(testDir).filter(f => f.startsWith('audit-'));
    if (logFiles.length > 0) {
      results.push({ test: 'Log file creation', status: '✅' });
      console.log(`✅ Created ${logFiles.length} log file(s)\n`);
      
      // Check file contents
      const logContent = fs.readFileSync(path.join(testDir, logFiles[0]), 'utf8');
      const lines = logContent.split('\n').filter(l => l.trim());
      console.log(`   File contains ${lines.length} log entries\n`);
    } else {
      results.push({ test: 'Log file creation', status: '❌' });
      console.log('❌ No log files created\n');
    }

    // Test 11: Verify data redaction
    console.log('Test 11: Verifying sensitive data redaction...');
    const allLogs = await logger.query({});
    const credentialLog = allLogs.find(l => l.type === AuditEventType.CREDENTIAL_ACCESSED);
    
    if (credentialLog && credentialLog.details) {
      const hasRedacted = 
        credentialLog.details.password === '[REDACTED]' &&
        credentialLog.details.apiKey === '[REDACTED]';
      
      if (hasRedacted) {
        results.push({ test: 'Data redaction', status: '✅' });
        console.log('✅ Sensitive data properly redacted\n');
      } else {
        results.push({ test: 'Data redaction', status: '❌' });
        console.log('❌ Sensitive data not redacted properly\n');
      }
    } else {
      results.push({ test: 'Data redaction', status: '❌' });
      console.log('❌ Could not verify data redaction\n');
    }

    // Test 12: Verify compliance fields
    console.log('Test 12: Verifying SOC2 compliance fields...');
    const systemLog = allLogs.find(l => l.type === AuditEventType.SYSTEM_START);
    
    if (systemLog && systemLog.details && systemLog.details.controlFamily) {
      results.push({ test: 'Compliance fields', status: '✅' });
      console.log(`✅ SOC2 control family: ${systemLog.details.controlFamily}\n`);
    } else {
      results.push({ test: 'Compliance fields', status: '❌' });
      console.log('❌ Compliance fields not found\n');
    }

    // Test 13: Generate HTML report
    console.log('Test 13: Generating HTML report...');
    const htmlReport = await logger.generateReport({
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(),
      format: 'html'
    });
    
    if (htmlReport.includes('<html>') && htmlReport.includes('Audit Report')) {
      results.push({ test: 'HTML report', status: '✅' });
      const reportPath = path.join(testDir, 'report.html');
      fs.writeFileSync(reportPath, htmlReport);
      console.log(`✅ Generated HTML report (saved to ${reportPath})\n`);
    } else {
      results.push({ test: 'HTML report', status: '❌' });
      console.log('❌ Failed to generate HTML report\n');
    }

    // Test 14: Generate CSV report
    console.log('Test 14: Generating CSV report...');
    const csvReport = await logger.generateReport({
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(),
      format: 'csv'
    });
    
    if (csvReport.includes('Timestamp,Type,Severity')) {
      results.push({ test: 'CSV report', status: '✅' });
      const csvPath = path.join(testDir, 'report.csv');
      fs.writeFileSync(csvPath, csvReport);
      console.log(`✅ Generated CSV report (saved to ${csvPath})\n`);
    } else {
      results.push({ test: 'CSV report', status: '❌' });
      console.log('❌ Failed to generate CSV report\n');
    }

    // Clean up
    logger.destroy();

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    results.push({ test: 'Error occurred', status: '❌', error: error.message });
  } finally {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      // Keep the directory for manual inspection if needed
      console.log(`📁 Test files available at: ${testDir}\n`);
    }
  }

  // Print summary
  console.log('═'.repeat(50));
  console.log('📊 Test Summary:\n');
  
  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  
  results.forEach(r => {
    console.log(`${r.status} ${r.test}`);
  });
  
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`📈 Success Rate: ${Math.round(passed / results.length * 100)}%`);
  
  if (passed === results.length) {
    console.log('\n🎉 All audit logger tests passed!');
  }
}

// Run tests
runTests().catch(console.error);