#!/usr/bin/env node

/**
 * Example: Migrating from Selenium WebDriver to PlayClone
 * 
 * This example shows how to use PlayClone's Selenium compatibility layer
 * to run existing Selenium code with minimal changes.
 */

// Original Selenium import (commented out):
// const { Builder, By, Key, until } = require('selenium-webdriver');

// PlayClone Selenium compatibility import:
const { 
  SeleniumWebDriver, 
  By, 
  Keys, 
  WebDriverWait, 
  ExpectedConditions,
  createWebDriver 
} = require('../dist/compatibility/SeleniumWebDriverCompatibility');

console.log('\n🚀 Selenium to PlayClone Migration Example\n');
console.log('This example demonstrates how existing Selenium code');
console.log('can run on PlayClone with minimal modifications.\n');
console.log('='.repeat(60));

/**
 * Example 1: Basic Navigation and Element Interaction
 * This code works with both Selenium and PlayClone!
 */
async function example1_BasicAutomation() {
  console.log('\n📝 Example 1: Basic Web Automation');
  console.log('-'.repeat(40));
  
  // Create driver (Selenium style)
  const driver = createWebDriver({ 
    headless: true,
    browserName: 'chromium' 
  });
  
  try {
    // Navigate to a website
    await driver.get('https://www.google.com');
    console.log('✅ Navigated to Google');
    
    // Get page title
    const title = await driver.getTitle();
    console.log(`📄 Page title: ${title}`);
    
    // Find search box
    const searchBox = await driver.findElement(By.name('q'));
    console.log('✅ Found search box');
    
    // Type search query
    await searchBox.sendKeys('PlayClone browser automation');
    console.log('✅ Entered search query');
    
    // Submit search
    await searchBox.sendKeys(Keys.ENTER);
    console.log('✅ Submitted search');
    
    // Wait for results
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get current URL
    const url = await driver.getCurrentUrl();
    console.log(`🌐 Current URL: ${url}`);
    
  } finally {
    await driver.quit();
    console.log('✅ Browser closed');
  }
}

/**
 * Example 2: Using WebDriverWait and Expected Conditions
 */
async function example2_ExplicitWaits() {
  console.log('\n🕰️ Example 2: Explicit Waits');
  console.log('-'.repeat(40));
  
  const driver = createWebDriver({ headless: true });
  const wait = new WebDriverWait(driver, 10000);
  
  try {
    await driver.get('https://example.com');
    console.log('✅ Page loaded');
    
    // Wait for specific element to be present
    const heading = await wait.until(
      ExpectedConditions.presenceOfElementLocated(By.tagName('h1')),
      'Waiting for heading'
    );
    console.log('✅ Heading element found');
    
    // Get heading text
    const text = await heading.getText();
    console.log(`📄 Heading text: ${text}`);
    
    // Wait for title to contain specific text
    await wait.until(
      ExpectedConditions.titleContains('Example'),
      'Waiting for title'
    );
    console.log('✅ Title condition met');
    
  } finally {
    await driver.quit();
  }
}

/**
 * Example 3: Form Filling and Submission
 */
async function example3_FormAutomation() {
  console.log('\n📝 Example 3: Form Automation');
  console.log('-'.repeat(40));
  
  const driver = createWebDriver({ headless: true });
  
  try {
    await driver.get('https://www.w3schools.com/html/html_forms.asp');
    console.log('✅ Navigated to form page');
    
    // Find form elements using different strategies
    const elements = {
      byId: await driver.findElement(By.id('fname')),
      byCss: await driver.findElement(By.css('input[type="text"]')),
      byXpath: await driver.findElement(By.xpath('//input[@type="submit"]'))
    };
    
    // Fill form field
    await elements.byId.clear();
    await elements.byId.sendKeys('John Doe');
    console.log('✅ Filled form field');
    
    // Get attribute
    const value = await elements.byId.getAttribute('value');
    console.log(`📄 Field value: ${value}`);
    
    // Check if element is displayed
    const isVisible = await elements.byXpath.isDisplayed();
    console.log(`👁️ Submit button visible: ${isVisible}`);
    
  } finally {
    await driver.quit();
  }
}

/**
 * Example 4: JavaScript Execution
 */
async function example4_JavaScriptExecution() {
  console.log('\n⚙️ Example 4: JavaScript Execution');
  console.log('-'.repeat(40));
  
  const driver = createWebDriver({ headless: true });
  
  try {
    await driver.get('https://example.com');
    
    // Execute JavaScript to get page info
    const pageInfo = await driver.executeScript(`
      return {
        title: document.title,
        url: window.location.href,
        timestamp: Date.now(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    `);
    
    console.log('✅ Executed JavaScript');
    console.log('📄 Page info:', JSON.stringify(pageInfo, null, 2));
    
    // Execute JavaScript with arguments
    const result = await driver.executeScript(
      'return arguments[0] + arguments[1];',
      10, 20
    );
    console.log(`🧮 Calculation result: ${result}`);
    
  } finally {
    await driver.quit();
  }
}

/**
 * Example 5: Action Chains
 */
async function example5_ActionChains() {
  console.log('\n🎯 Example 5: Action Chains');
  console.log('-'.repeat(40));
  
  const driver = createWebDriver({ headless: true });
  
  try {
    await driver.get('https://example.com');
    
    // Create complex action chain
    await driver.actions()
      .pause(500)
      .sendKeys('Hello ')
      .keyDown(Keys.SHIFT)
      .sendKeys('world')
      .keyUp(Keys.SHIFT)
      .pause(500)
      .sendKeys(Keys.BACKSPACE)
      .perform();
    
    console.log('✅ Executed action chain');
    
    // Find element and perform actions on it
    const heading = await driver.findElement(By.tagName('h1'));
    await driver.actions()
      .moveToElement(heading)
      .pause(1000)
      .click()
      .perform();
    
    console.log('✅ Performed element interactions');
    
  } finally {
    await driver.quit();
  }
}

/**
 * Example 6: Browser Management
 */
async function example6_BrowserManagement() {
  console.log('\n🌐 Example 6: Browser Management');
  console.log('-'.repeat(40));
  
  const driver = createWebDriver({ headless: true });
  
  try {
    await driver.get('https://example.com');
    
    // Window management
    await driver.manage.window().setSize(1280, 720);
    const size = await driver.manage.window().getSize();
    console.log(`🖼️ Window size: ${size.width}x${size.height}`);
    
    // Cookie management
    await driver.manage.addCookie({
      name: 'test_cookie',
      value: 'selenium_compat',
      domain: '.example.com'
    });
    console.log('✅ Added cookie');
    
    const cookies = await driver.manage.getCookies();
    console.log(`🍪 Total cookies: ${cookies.length}`);
    
    // Timeout management
    await driver.manage.timeouts().implicitlyWait(5000);
    await driver.manage.timeouts().pageLoadTimeout(30000);
    console.log('✅ Set timeouts');
    
    // Navigation
    await driver.get('https://www.w3.org/');
    await driver.back();
    console.log('✅ Navigated back');
    
    await driver.forward();
    console.log('✅ Navigated forward');
    
    await driver.refresh();
    console.log('✅ Page refreshed');
    
  } finally {
    await driver.quit();
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  try {
    await example1_BasicAutomation();
    await example2_ExplicitWaits();
    await example3_FormAutomation();
    await example4_JavaScriptExecution();
    await example5_ActionChains();
    await example6_BrowserManagement();
    
    console.log('\n' + '='.repeat(60));
    console.log('✨ All examples completed successfully!');
    console.log('\n💡 Migration Tips:');
    console.log('1. Replace selenium-webdriver imports with PlayClone');
    console.log('2. Use createWebDriver() instead of new Builder().build()');
    console.log('3. Most Selenium code works without modification!');
    console.log('4. Enjoy faster performance with PlayClone!');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error running examples:', error.message);
    process.exit(1);
  }
}

// Run the examples
runExamples();