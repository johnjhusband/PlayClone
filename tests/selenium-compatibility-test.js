#!/usr/bin/env node

/**
 * Test Selenium WebDriver compatibility layer
 */

const { SeleniumWebDriver, By, Keys, WebDriverWait, ExpectedConditions } = require('../dist/compatibility/SeleniumWebDriverCompatibility');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

let passCount = 0;
let failCount = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, success, details = '') {
  if (success) {
    passCount++;
    log(`  ✅ ${name}`, 'green');
  } else {
    failCount++;
    log(`  ❌ ${name}`, 'red');
    if (details) log(`     ${details}`, 'yellow');
  }
}

async function testBasicNavigation() {
  log('\n🧪 Testing Basic Navigation...', 'cyan');
  const driver = new SeleniumWebDriver({ headless: true });
  
  try {
    // Test navigation
    await driver.get('https://example.com');
    logTest('Navigate to URL', true);
    
    // Test getting current URL
    const url = await driver.getCurrentUrl();
    logTest('Get current URL', url.includes('example.com'), url);
    
    // Test getting title
    const title = await driver.getTitle();
    logTest('Get page title', title.includes('Example'), title);
    
    // Test getting page source
    const source = await driver.getPageSource();
    logTest('Get page source', source.includes('<!DOCTYPE'), `Source length: ${source.length}`);
    
    await driver.quit();
    logTest('Close browser', true);
    
    return true;
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
    await driver.quit().catch(() => {});
    return false;
  }
}

async function testElementInteractions() {
  log('\n🧪 Testing Element Interactions...', 'cyan');
  const driver = new SeleniumWebDriver({ headless: true });
  
  try {
    await driver.get('https://www.w3schools.com/html/html_forms.asp');
    
    // Test finding element by ID
    try {
      const element = await driver.findElement(By.id('fname'));
      logTest('Find element by ID', !!element);
    } catch {
      logTest('Find element by ID', false, 'Element not found');
    }
    
    // Test finding elements by tag name
    const inputs = await driver.findElements(By.tagName('input'));
    logTest('Find elements by tag', inputs.length > 0, `Found ${inputs.length} inputs`);
    
    // Test finding element by CSS
    try {
      const button = await driver.findElement(By.css('input[type="submit"]'));
      logTest('Find element by CSS', !!button);
      
      // Test element methods
      const tagName = await button.getTagName();
      logTest('Get element tag name', tagName === 'input', tagName);
      
      const isDisplayed = await button.isDisplayed();
      logTest('Check element visibility', isDisplayed === true);
    } catch (error) {
      logTest('Find element by CSS', false, error.message);
    }
    
    await driver.quit();
    return true;
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
    await driver.quit().catch(() => {});
    return false;
  }
}

async function testFormFilling() {
  log('\n🧪 Testing Form Filling...', 'cyan');
  const driver = new SeleniumWebDriver({ headless: true });
  
  try {
    await driver.get('https://www.w3schools.com/html/html_forms.asp');
    
    // Find and fill form fields
    try {
      const firstName = await driver.findElement(By.id('fname'));
      await firstName.clear();
      await firstName.sendKeys('John');
      logTest('Fill text input', true);
      
      const text = await firstName.getAttribute('value');
      logTest('Verify input value', text === 'John', text);
    } catch (error) {
      logTest('Form interaction', false, error.message);
    }
    
    await driver.quit();
    return true;
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
    await driver.quit().catch(() => {});
    return false;
  }
}

async function testJavaScriptExecution() {
  log('\n🧪 Testing JavaScript Execution...', 'cyan');
  const driver = new SeleniumWebDriver({ headless: true });
  
  try {
    await driver.get('https://example.com');
    
    // Execute JavaScript
    const result = await driver.executeScript('return document.title');
    logTest('Execute JavaScript', result.includes('Example'), result);
    
    // Execute JavaScript with arguments
    const computed = await driver.executeScript('return arguments[0] + arguments[1]', 2, 3);
    logTest('Execute JS with args', computed === 5, `Result: ${computed}`);
    
    await driver.quit();
    return true;
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
    await driver.quit().catch(() => {});
    return false;
  }
}

async function testWaitConditions() {
  log('\n🧪 Testing Wait Conditions...', 'cyan');
  const driver = new SeleniumWebDriver({ headless: true });
  
  try {
    await driver.get('https://example.com');
    const wait = new WebDriverWait(driver, 5000);
    
    // Wait for title
    const hasTitle = await wait.until(
      ExpectedConditions.titleContains('Example'),
      'Title should contain Example'
    );
    logTest('Wait for title', hasTitle === true);
    
    // Wait for element
    const element = await wait.until(
      ExpectedConditions.presenceOfElementLocated(By.tagName('h1')),
      'H1 should be present'
    );
    logTest('Wait for element presence', !!element);
    
    await driver.quit();
    return true;
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
    await driver.quit().catch(() => {});
    return false;
  }
}

async function testBrowserManagement() {
  log('\n🧪 Testing Browser Management...', 'cyan');
  const driver = new SeleniumWebDriver({ headless: true });
  
  try {
    await driver.get('https://example.com');
    
    // Test window management
    await driver.manage.window().setSize(1024, 768);
    const size = await driver.manage.window().getSize();
    logTest('Set window size', size?.width === 1024, `${size?.width}x${size?.height}`);
    
    // Test cookie management
    await driver.manage.addCookie({
      name: 'test',
      value: 'selenium',
      domain: '.example.com'
    });
    
    const cookies = await driver.manage.getCookies();
    const testCookie = cookies.find(c => c.name === 'test');
    logTest('Add cookie', !!testCookie, testCookie?.value);
    
    await driver.manage.deleteAllCookies();
    const clearedCookies = await driver.manage.getCookies();
    logTest('Clear cookies', clearedCookies.length === 0, `${clearedCookies.length} cookies remaining`);
    
    // Test timeouts
    await driver.manage.timeouts().implicitlyWait(5000);
    logTest('Set implicit wait', true);
    
    await driver.quit();
    return true;
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
    await driver.quit().catch(() => {});
    return false;
  }
}

async function testActionChains() {
  log('\n🧪 Testing Action Chains...', 'cyan');
  const driver = new SeleniumWebDriver({ headless: true });
  
  try {
    await driver.get('https://example.com');
    
    // Test action builder
    const actions = driver.actions();
    
    // Build and perform action chain
    await actions
      .pause(500)
      .sendKeys('Hello')
      .keyDown(Keys.SHIFT)
      .sendKeys('world')
      .keyUp(Keys.SHIFT)
      .perform();
    
    logTest('Execute action chain', true);
    
    await driver.quit();
    return true;
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
    await driver.quit().catch(() => {});
    return false;
  }
}

async function testScreenshot() {
  log('\n🧪 Testing Screenshot...', 'cyan');
  const driver = new SeleniumWebDriver({ headless: true });
  
  try {
    await driver.get('https://example.com');
    
    // Take screenshot
    const screenshot = await driver.getScreenshotAsBase64();
    logTest('Take screenshot', screenshot.length > 100, `Screenshot size: ${screenshot.length}`);
    
    await driver.quit();
    return true;
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
    await driver.quit().catch(() => {});
    return false;
  }
}

async function testNavigation() {
  log('\n🧪 Testing Browser Navigation...', 'cyan');
  const driver = new SeleniumWebDriver({ headless: true });
  
  try {
    // Navigate to first page
    await driver.get('https://example.com');
    const url1 = await driver.getCurrentUrl();
    
    // Navigate to second page
    await driver.get('https://www.w3.org/');
    const url2 = await driver.getCurrentUrl();
    logTest('Navigate forward', url2.includes('w3.org'), url2);
    
    // Go back
    await driver.back();
    const urlBack = await driver.getCurrentUrl();
    logTest('Navigate back', urlBack.includes('example.com'), urlBack);
    
    // Go forward
    await driver.forward();
    const urlForward = await driver.getCurrentUrl();
    logTest('Navigate forward', urlForward.includes('w3.org'), urlForward);
    
    // Refresh
    await driver.refresh();
    logTest('Refresh page', true);
    
    await driver.quit();
    return true;
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
    await driver.quit().catch(() => {});
    return false;
  }
}

async function testByLocators() {
  log('\n🧪 Testing By Locator Strategies...', 'cyan');
  const driver = new SeleniumWebDriver({ headless: true });
  
  try {
    await driver.get('https://www.w3schools.com/html/html_forms.asp');
    
    // Test different locator strategies
    const strategies = [
      { by: By.tagName('form'), name: 'By.tagName' },
      { by: By.css('input[type="text"]'), name: 'By.css' },
      { by: By.xpath('//input[@type="submit"]'), name: 'By.xpath' },
      { by: By.className('w3-code'), name: 'By.className' },
      { by: By.partialLinkText('HTML'), name: 'By.partialLinkText' }
    ];
    
    for (const strategy of strategies) {
      try {
        const elements = await driver.findElements(strategy.by);
        logTest(`${strategy.name}`, elements.length > 0, `Found ${elements.length} elements`);
      } catch (error) {
        logTest(`${strategy.name}`, false, error.message);
      }
    }
    
    await driver.quit();
    return true;
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
    await driver.quit().catch(() => {});
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  log('🚀 Selenium WebDriver Compatibility Test Suite', 'magenta');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  // Run all test suites
  await testBasicNavigation();
  await testElementInteractions();
  await testFormFilling();
  await testJavaScriptExecution();
  await testWaitConditions();
  await testBrowserManagement();
  await testActionChains();
  await testScreenshot();
  await testNavigation();
  await testByLocators();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  log('📊 Test Summary', 'magenta');
  console.log('='.repeat(60));
  
  const total = passCount + failCount;
  const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : 0;
  
  log(`✅ Passed: ${passCount}`, 'green');
  log(`❌ Failed: ${failCount}`, failCount > 0 ? 'red' : 'green');
  log(`📈 Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'yellow');
  log(`⏱️  Duration: ${duration}s`, 'cyan');
  
  console.log('\n' + '='.repeat(60));
  
  if (passRate >= 80) {
    log('✨ Selenium WebDriver compatibility layer is working!', 'green');
  } else {
    log('⚠️  Some compatibility issues detected', 'yellow');
  }
  
  console.log('='.repeat(60) + '\n');
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});