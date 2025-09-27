const { UserStoryParser, TestCaseGenerator } = require('../dist/ai');
const fs = require('fs');

async function demonstrateTestGeneration() {
  console.log('🎯 PlayClone - Intelligent Test Generation from User Stories\n');
  
  // Example 1: E-commerce checkout user story
  const ecommerceStory = `
As a customer,
I want to complete the checkout process
so that I can purchase items from my shopping cart.

Acceptance Criteria:
- User can view items in their cart
- User can enter shipping information
- User can select payment method
- User receives order confirmation
- Invalid payment information shows error

Epic: E-commerce Platform
Sprint: Sprint 23
Story Points: 8
Assigned to: QA Team

Scenario: Successful checkout with credit card
Given the user has items in their shopping cart
When the user navigates to checkout
And the user enters valid shipping information
And the user selects credit card payment
And the user enters valid card details
And the user clicks "Place Order"
Then the user should see an order confirmation
And the user should receive a confirmation email

Scenario: Checkout with invalid card
Given the user has items in their shopping cart
When the user navigates to checkout
And the user enters valid shipping information
And the user selects credit card payment
And the user enters invalid card details
And the user clicks "Place Order"
Then the user should see an error message "Invalid card information"
And the order should not be processed
`;

  // Example 2: Login functionality user story
  const loginStory = `
As a registered user,
I want to log into my account
so that I can access my personalized dashboard.

Acceptance Criteria:
- User can enter email and password
- Valid credentials grant access to dashboard
- Invalid credentials show error message
- User can reset forgotten password
- Session persists across page refreshes

@critical @authentication
Scenario: Successful login
Given the user is on the login page
When the user enters "user@example.com" in the email field
And the user enters "SecurePass123!" in the password field
And the user clicks the "Login" button
Then the user should be redirected to the dashboard
And the user should see "Welcome back!" message

@security @negative
Scenario: Login with incorrect password
Given the user is on the login page
When the user enters "user@example.com" in the email field
And the user enters "WrongPassword" in the password field
And the user clicks the "Login" button
Then the user should see error message "Invalid email or password"
And the user should remain on the login page
`;

  // Example 3: Search functionality
  const searchStory = `
As a visitor,
I want to search for products
so that I can find items I'm interested in.

Acceptance Criteria:
- Search bar is visible on all pages
- Search returns relevant results
- No results shows appropriate message
- Search supports filters and sorting
- Recent searches are saved

Scenario: Search for existing product
Given the user is on the home page
When the user enters "laptop" in the search bar
And the user presses Enter
Then the user should see search results for "laptop"
And the results should show at least 10 products
And each result should have a title, price, and image
`;

  // Initialize parser and generator
  const parser = new UserStoryParser();
  const generator = new TestCaseGenerator();

  console.log('=' . repeat(60));
  console.log('1. E-COMMERCE CHECKOUT STORY');
  console.log('=' . repeat(60));
  
  // Parse the e-commerce story
  const parsedEcommerce = parser.parseUserStory(ecommerceStory);
  console.log('\n📝 Parsed User Story:');
  console.log(`Title: ${parsedEcommerce.title}`);
  console.log(`As a: ${parsedEcommerce.asA}`);
  console.log(`I want: ${parsedEcommerce.iWant}`);
  console.log(`So that: ${parsedEcommerce.soThat}`);
  console.log(`Scenarios found: ${parsedEcommerce.scenarios.length}`);
  console.log(`Metadata:`, parsedEcommerce.metadata);

  // Generate test suite for e-commerce
  const ecommerceSuite = await generator.generateFromUserStory(ecommerceStory, {
    framework: 'playclone',
    language: 'javascript',
    includeNegativeTests: true,
    includePerformanceTests: true
  });

  console.log('\n🧪 Generated Test Suite:');
  console.log(`Suite Name: ${ecommerceSuite.name}`);
  console.log(`Total Test Cases: ${ecommerceSuite.testCases.length}`);
  console.log(`Estimated Duration: ${ecommerceSuite.totalDuration}s`);
  
  console.log('\n📋 Test Cases:');
  for (const testCase of ecommerceSuite.testCases) {
    console.log(`  - ${testCase.name}`);
    console.log(`    Category: ${testCase.category}`);
    console.log(`    Tags: ${testCase.tags.join(', ')}`);
    console.log(`    Duration: ${testCase.estimatedDuration}s`);
  }

  // Show sample generated code
  if (ecommerceSuite.testCases.length > 0) {
    console.log('\n💻 Sample Generated Test Code:');
    console.log('-'.repeat(60));
    console.log(ecommerceSuite.testCases[0].code);
    console.log('-'.repeat(60));
  }

  console.log('\n' + '='.repeat(60));
  console.log('2. LOGIN FUNCTIONALITY STORY');
  console.log('='.repeat(60));

  // Parse the login story
  const parsedLogin = parser.parseUserStory(loginStory);
  console.log('\n📝 Parsed User Story:');
  console.log(`Title: ${parsedLogin.title}`);
  console.log(`Scenarios: ${parsedLogin.scenarios.length}`);
  
  // Extract intent and entities from a scenario step
  const sampleStep = parsedLogin.scenarios[0].steps[1];
  const intentAndEntities = parser.extractIntentAndEntities(sampleStep.action);
  console.log('\n🔍 Intent & Entity Extraction:');
  console.log(`Step: "${sampleStep.action}"`);
  console.log(`Intent: ${intentAndEntities.intent}`);
  console.log(`Entities:`, intentAndEntities.entities);

  // Generate test outline
  const testOutline = parser.generateTestOutline(parsedLogin);
  console.log('\n📄 Test Outline:');
  console.log(testOutline);

  // Infer test data
  const inferredData = parser.inferTestData(parsedLogin);
  console.log('📊 Inferred Test Data:');
  console.log(JSON.stringify(inferredData, null, 2));

  // Generate tests for different frameworks
  console.log('\n🔄 Cross-Framework Test Generation:');
  const loginSuite = await generator.generateFromUserStory(loginStory, {
    framework: 'playclone',
    language: 'javascript'
  });

  // Convert to different frameworks
  const frameworks = ['playwright', 'puppeteer', 'cypress'];
  for (const framework of frameworks) {
    const convertedTest = generator.convertToFramework(
      loginSuite.testCases[0],
      framework
    );
    console.log(`\n${framework.toUpperCase()} Version:`);
    console.log('-'.repeat(40));
    console.log(convertedTest.code.substring(0, 200) + '...');
  }

  console.log('\n' + '='.repeat(60));
  console.log('3. GHERKIN SCENARIO PARSING');
  console.log('='.repeat(60));

  const gherkinScenario = `
@smoke @regression
Scenario: User updates profile information
Given the user is logged into their account
And the user is on the profile settings page
When the user updates their display name to "John Doe"
And the user updates their bio to "Software Developer"
And the user clicks the "Save Changes" button
Then the user should see a success message "Profile updated successfully"
And the updated information should be displayed on the profile page
`;

  console.log('\n📝 Gherkin Scenario:');
  console.log(gherkinScenario);

  const parsedGherkin = parser.parseGherkinScenario(gherkinScenario);
  console.log('\n✅ Parsed Gherkin:');
  console.log(`Title: ${parsedGherkin.title}`);
  console.log(`Priority: ${parsedGherkin.priority}`);
  console.log(`Tags: ${parsedGherkin.tags.join(', ')}`);
  console.log(`Steps: ${parsedGherkin.steps.length}`);

  const gherkinTest = generator.generateFromGherkin(
    gherkinScenario,
    'playclone',
    'javascript'
  );
  console.log('\n💻 Generated Test from Gherkin:');
  console.log(gherkinTest.code);

  console.log('\n' + '='.repeat(60));
  console.log('4. ADVANCED FEATURES');
  console.log('='.repeat(60));

  // Suggest additional scenarios
  const suggestions = parser.suggestAdditionalScenarios(parsedLogin);
  console.log('\n💡 Suggested Additional Test Scenarios:');
  for (const suggestion of suggestions) {
    console.log(`  - ${suggestion.title}`);
    console.log(`    Tags: ${suggestion.tags.join(', ')}`);
  }

  // Generate Page Object Model
  const pageObjectCode = generator.generatePageObjectModel(parsedLogin);
  console.log('\n📦 Generated Page Object Model:');
  console.log('-'.repeat(60));
  console.log(pageObjectCode.substring(0, 500) + '...');
  console.log('-'.repeat(60));

  // Data-driven test generation
  const dataSets = [
    { email: 'user1@test.com', password: 'Pass123!' },
    { email: 'user2@test.com', password: 'Pass456!' },
    { email: 'admin@test.com', password: 'AdminPass!' }
  ];
  
  const dataDrivenTests = generator.generateDataDrivenTests(
    loginSuite.testCases[0],
    dataSets
  );
  console.log('\n📊 Data-Driven Tests Generated:');
  console.log(`Created ${dataDrivenTests.length} parameterized tests from ${dataSets.length} data sets`);

  // Optimize test suite
  const optimizedSuite = generator.optimizeTestSuite(ecommerceSuite);
  console.log('\n⚡ Suite Optimization:');
  console.log(`Original test count: ${ecommerceSuite.testCases.length}`);
  console.log(`Optimized test count: ${optimizedSuite.testCases.length}`);
  console.log(`Execution order optimized by priority and duration`);

  // Generate CI/CD configuration
  const cicdConfig = generator.generateCICDConfig(optimizedSuite);
  console.log('\n🚀 Generated CI/CD Configuration:');
  console.log('-'.repeat(60));
  console.log(cicdConfig.substring(0, 400) + '...');
  console.log('-'.repeat(60));

  // Save generated tests to file
  const outputDir = './generated-tests';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const testFilePath = `${outputDir}/ecommerce-checkout.test.js`;
  const fullTestCode = `
// Auto-generated test suite from user story
// Generated by PlayClone Test Generator

${ecommerceSuite.setup}

describe('${ecommerceSuite.name}', () => {
${ecommerceSuite.testCases.map(tc => tc.code).join('\n')}
});

${ecommerceSuite.teardown}
`;

  fs.writeFileSync(testFilePath, fullTestCode);
  console.log(`\n✅ Test suite saved to: ${testFilePath}`);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Test Generation Complete!');
  console.log('='.repeat(60));
  console.log('\nKey Features Demonstrated:');
  console.log('  ✅ User story parsing with natural language processing');
  console.log('  ✅ Gherkin scenario parsing (Given-When-Then)');
  console.log('  ✅ Multi-framework test generation');
  console.log('  ✅ Intent and entity extraction');
  console.log('  ✅ Test data inference');
  console.log('  ✅ Negative and edge case generation');
  console.log('  ✅ Page Object Model generation');
  console.log('  ✅ Data-driven test creation');
  console.log('  ✅ Test suite optimization');
  console.log('  ✅ CI/CD configuration generation');
  
  console.log('\n📚 Use Cases:');
  console.log('  - Convert business requirements to executable tests');
  console.log('  - Generate tests from Jira/Azure DevOps stories');
  console.log('  - Create comprehensive test coverage automatically');
  console.log('  - Standardize test implementation across teams');
  console.log('  - Accelerate test development by 10x');
}

// Run the demonstration
demonstrateTestGeneration().catch(console.error);