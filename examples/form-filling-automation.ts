/**
 * Form Filling Automation Example
 * 
 * This example demonstrates PlayClone's advanced form handling capabilities:
 * - Text input fields
 * - Dropdowns and select elements
 * - Radio buttons and checkboxes
 * - File uploads
 * - Date pickers
 * - Multi-step forms
 * - Form validation handling
 * - Auto-complete fields
 */

import { PlayClone } from '../src/index';

async function formFillingAutomation() {
    console.log('📝 Starting Form Filling Automation Example\n');
    
    // Initialize PlayClone
    const pc = new PlayClone({
        headless: false,  // Set to true for production
        viewport: { width: 1280, height: 720 }
    });

    try {
        // Example 1: Basic Contact Form
        console.log('📧 Example 1: Basic Contact Form\n');
        await basicContactForm(pc);
        
        // Example 2: Complex Registration Form
        console.log('\n👤 Example 2: User Registration Form\n');
        await complexRegistrationForm(pc);
        
        // Example 3: Multi-step Wizard Form
        console.log('\n🧙 Example 3: Multi-step Wizard Form\n');
        await multiStepWizard(pc);
        
        // Example 4: Dynamic Form with Validation
        console.log('\n✅ Example 4: Form with Validation\n');
        await formWithValidation(pc);
        
        // Example 5: Government/Official Forms
        console.log('\n🏛️ Example 5: Official Form Pattern\n');
        await officialFormPattern(pc);
        
    } catch (error) {
        console.error('Error in form filling automation:', error);
    } finally {
        await pc.close();
        console.log('\n✅ Form filling automation example completed');
    }
}

/**
 * Basic contact form example
 */
async function basicContactForm(pc: PlayClone) {
    console.log('Navigating to contact form demo...');
    await pc.navigate('https://www.w3schools.com/howto/tryit.asp?filename=tryhow_css_contact_form');
    
    // Switch to iframe if needed
    await pc.switchToFrame('result frame');
    
    console.log('Filling contact form...');
    
    // Fill text fields
    await pc.fill('first name field', 'John');
    await pc.fill('last name field', 'Smith');
    
    // Select country from dropdown
    await pc.select('country dropdown', 'Canada');
    
    // Fill message
    await pc.fill('subject textarea', 'This is an automated test message from PlayClone. The form filling capabilities work great!');
    
    // Take screenshot of filled form
    const screenshot = await pc.screenshot('contact-form-filled.png');
    if (screenshot.success) {
        console.log('✓ Screenshot saved: contact-form-filled.png');
    }
    
    // Submit form (commented out to avoid actual submission)
    // await pc.click('submit button');
    
    console.log('✓ Basic contact form filled successfully');
}

/**
 * Complex registration form with various input types
 */
async function complexRegistrationForm(pc: PlayClone) {
    console.log('Navigating to registration form...');
    await pc.navigate('https://demoqa.com/automation-practice-form');
    
    console.log('Filling registration form...');
    
    // Personal Information
    await pc.fill('first name', 'Jane');
    await pc.fill('last name', 'Doe');
    await pc.fill('email', 'jane.doe@example.com');
    
    // Radio button selection
    await pc.click('gender radio button Female');
    
    // Phone number
    await pc.fill('mobile number', '5551234567');
    
    // Date picker
    await pc.click('date of birth input');
    await pc.select('month dropdown', 'March');
    await pc.select('year dropdown', '1990');
    await pc.click('day 15 in calendar');
    
    // Subjects with auto-complete
    await pc.fill('subjects input', 'Computer Science');
    await pc.press('Enter');
    await pc.fill('subjects input', 'Mathematics');
    await pc.press('Enter');
    
    // Checkboxes for hobbies
    await pc.check('Sports checkbox');
    await pc.check('Reading checkbox');
    await pc.check('Music checkbox');
    
    // File upload (simulated)
    console.log('Handling file upload...');
    // In real scenario: await pc.uploadFile('picture upload', '/path/to/file.jpg');
    
    // Current Address
    await pc.fill('current address textarea', '123 Main Street\nApt 4B\nNew York, NY 10001');
    
    // State and City dropdowns
    await pc.click('state dropdown');
    await pc.click('NCR option');
    
    await pc.click('city dropdown');
    await pc.click('Delhi option');
    
    console.log('✓ Complex registration form filled successfully');
    
    // Save form state for later
    await pc.saveState('registration-form-state');
    console.log('✓ Form state saved');
}

/**
 * Multi-step wizard form example
 */
async function multiStepWizard(pc: PlayClone) {
    console.log('Navigating to multi-step form...');
    await pc.navigate('https://www.w3schools.com/howto/tryit.asp?filename=tryhow_js_form_steps');
    
    await pc.switchToFrame('result frame');
    
    console.log('Starting multi-step wizard...');
    
    // Step 1: Personal Info
    console.log('Step 1: Personal Information');
    await pc.fill('first name input', 'Robert');
    await pc.fill('last name input', 'Johnson');
    await pc.click('next button');
    await pc.waitForContent();
    
    // Step 2: Contact Info
    console.log('Step 2: Contact Information');
    await pc.fill('email input', 'robert.j@example.com');
    await pc.fill('phone input', '555-0123');
    await pc.click('next button');
    await pc.waitForContent();
    
    // Step 3: Additional Info
    console.log('Step 3: Additional Information');
    await pc.fill('birthday input', '01/01/1985');
    await pc.fill('security number input', '123-45-6789');
    await pc.click('next button');
    await pc.waitForContent();
    
    // Step 4: Review and Submit
    console.log('Step 4: Review');
    const reviewData = await pc.extractData({
        selector: 'review section',
        fields: ['name', 'email', 'phone']
    });
    
    if (reviewData.success && reviewData.data) {
        console.log('Review Data:');
        console.log(`  Name: ${reviewData.data.name || 'N/A'}`);
        console.log(`  Email: ${reviewData.data.email || 'N/A'}`);
        console.log(`  Phone: ${reviewData.data.phone || 'N/A'}`);
    }
    
    // Could click submit here
    // await pc.click('submit button');
    
    console.log('✓ Multi-step wizard completed');
}

/**
 * Form with validation handling
 */
async function formWithValidation(pc: PlayClone) {
    console.log('Testing form validation handling...');
    await pc.navigate('https://demoqa.com/text-box');
    
    // Test 1: Submit empty form to trigger validation
    console.log('Test 1: Checking validation messages...');
    await pc.click('submit button');
    
    // Check for validation errors
    const errors = await pc.extractData({
        selector: 'validation error messages',
        fields: ['field', 'message']
    });
    
    if (errors.success && errors.data) {
        console.log('Validation errors detected:', errors.data);
    }
    
    // Test 2: Fill with invalid data
    console.log('\nTest 2: Testing invalid data...');
    await pc.fill('email field', 'invalid-email');
    await pc.click('submit button');
    
    // Check email validation
    const emailError = await pc.getText('email validation error');
    if (emailError.success) {
        console.log(`Email validation: ${emailError.data}`);
    }
    
    // Test 3: Correct the errors
    console.log('\nTest 3: Filling with valid data...');
    await pc.fill('full name', 'Alice Williams');
    await pc.fill('email field', 'alice.williams@example.com');
    await pc.fill('current address', '456 Oak Avenue');
    await pc.fill('permanent address', '456 Oak Avenue');
    
    await pc.click('submit button');
    
    // Check for success message
    const success = await pc.getText('success message or output');
    if (success.success) {
        console.log('✓ Form submitted successfully');
    }
    
    console.log('✓ Validation handling completed');
}

/**
 * Official/Government form pattern
 */
async function officialFormPattern(pc: PlayClone) {
    console.log('Demonstrating official form patterns...');
    
    // This uses a mock government form pattern
    await pc.navigate('https://www.irs.gov/forms-pubs/about-form-1040');
    
    console.log('Analyzing official form structure...');
    
    // Extract form sections
    const formSections = await pc.extractData({
        selector: 'form sections or main content',
        fields: ['section', 'description']
    });
    
    if (formSections.success) {
        console.log('Form sections identified:', formSections.data);
    }
    
    // Demonstrate pattern for handling official forms
    console.log('\nOfficial Form Best Practices:');
    console.log('1. Save state frequently (every section)');
    console.log('2. Validate data before submission');
    console.log('3. Handle session timeouts gracefully');
    console.log('4. Keep copies of all entered data');
    console.log('5. Use precise selectors for critical fields');
    
    // Example pattern for tax form
    const taxFormPattern = {
        personalInfo: {
            fields: ['ssn', 'name', 'address', 'filing_status'],
            validation: ['ssn_format', 'required_fields']
        },
        income: {
            fields: ['wages', 'interest', 'dividends'],
            validation: ['numeric_only', 'positive_values']
        },
        deductions: {
            fields: ['standard_deduction', 'itemized_deductions'],
            validation: ['either_or_selection']
        }
    };
    
    console.log('\nTax Form Pattern Structure:');
    console.log(JSON.stringify(taxFormPattern, null, 2));
    
    console.log('✓ Official form pattern demonstrated');
}

/**
 * Utility function to auto-fill forms based on saved profiles
 */
async function autoFillFromProfile(pc: PlayClone, profileName: string) {
    // Load profile data
    const profiles: Record<string, any> = {
        'personal': {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '555-0100',
            address: '123 Main St',
            city: 'New York',
            state: 'NY',
            zip: '10001',
            country: 'USA'
        },
        'business': {
            companyName: 'Acme Corp',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@acme.com',
            phone: '555-0200',
            address: '456 Business Blvd',
            city: 'San Francisco',
            state: 'CA',
            zip: '94102',
            country: 'USA'
        }
    };
    
    const profile = profiles[profileName];
    if (!profile) {
        console.log(`Profile "${profileName}" not found`);
        return;
    }
    
    console.log(`Auto-filling form with ${profileName} profile...`);
    
    // Try to fill common fields
    const fieldMappings = [
        { patterns: ['first name', 'fname', 'given name'], value: profile.firstName },
        { patterns: ['last name', 'lname', 'surname', 'family name'], value: profile.lastName },
        { patterns: ['email', 'e-mail', 'email address'], value: profile.email },
        { patterns: ['phone', 'telephone', 'mobile', 'cell'], value: profile.phone },
        { patterns: ['address', 'street address', 'address line 1'], value: profile.address },
        { patterns: ['city', 'town'], value: profile.city },
        { patterns: ['state', 'province'], value: profile.state },
        { patterns: ['zip', 'postal code', 'postcode'], value: profile.zip },
        { patterns: ['country'], value: profile.country },
        { patterns: ['company', 'organization', 'business name'], value: profile.companyName }
    ];
    
    let filledCount = 0;
    for (const mapping of fieldMappings) {
        if (!mapping.value) continue;
        
        for (const pattern of mapping.patterns) {
            const result = await pc.fill(pattern, mapping.value);
            if (result.success) {
                console.log(`  ✓ Filled ${pattern}`);
                filledCount++;
                break;  // Move to next field once one pattern works
            }
        }
    }
    
    console.log(`✓ Auto-filled ${filledCount} fields from ${profileName} profile`);
    return filledCount;
}

/**
 * Utility to extract and save form data
 */
async function extractFormData(pc: PlayClone, formName: string) {
    console.log(`Extracting data from ${formName}...`);
    
    // Extract all form fields
    const formData = await pc.extractData({
        selector: 'form',
        fields: ['all_inputs', 'all_selects', 'all_textareas', 'all_checkboxes', 'all_radios']
    });
    
    if (formData.success && formData.data) {
        // Save to state
        await pc.saveState(`form-data-${formName}`);
        
        // Create summary
        const summary = {
            formName,
            timestamp: new Date().toISOString(),
            fields: formData.data,
            checksum: generateChecksum(JSON.stringify(formData.data))
        };
        
        console.log('Form Data Summary:');
        console.log(JSON.stringify(summary, null, 2));
        
        return summary;
    }
    
    return null;
}

/**
 * Simple checksum for form data verification
 */
function generateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;  // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
}

// Run the example if executed directly
if (require.main === module) {
    formFillingAutomation().catch(console.error);
}

export { 
    formFillingAutomation,
    basicContactForm,
    complexRegistrationForm,
    multiStepWizard,
    formWithValidation,
    officialFormPattern,
    autoFillFromProfile,
    extractFormData
};