/**
 * E-commerce Automation Example
 * 
 * This example demonstrates how to use PlayClone for common e-commerce automation tasks:
 * - Product search
 * - Adding items to cart
 * - Navigating product pages
 * - Extracting product information
 * - Handling dynamic content
 * - Managing shopping cart state
 */

import { PlayClone } from '../src/index';

async function ecommerceAutomation() {
    console.log('🛒 Starting E-commerce Automation Example\n');
    
    // Initialize PlayClone with visible browser for demonstration
    const pc = new PlayClone({
        headless: false,  // Set to true for production
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    try {
        // Example 1: Amazon Product Search and Cart Management
        console.log('📦 Example 1: Amazon Product Search\n');
        await amazonExample(pc);
        
        // Example 2: eBay Product Search and Price Extraction
        console.log('\n🏷️ Example 2: eBay Price Comparison\n');
        await ebayExample(pc);
        
        // Example 3: Generic E-commerce Site Pattern
        console.log('\n🛍️ Example 3: Generic E-commerce Pattern\n');
        await genericEcommerceExample(pc);
        
    } catch (error) {
        console.error('Error in e-commerce automation:', error);
    } finally {
        await pc.close();
        console.log('\n✅ E-commerce automation example completed');
    }
}

/**
 * Amazon automation example
 */
async function amazonExample(pc: PlayClone) {
    console.log('Navigating to Amazon...');
    const navResult = await pc.navigate('https://www.amazon.com');
    
    if (!navResult.success) {
        console.error('Failed to navigate to Amazon:', navResult.error);
        return;
    }
    
    // Search for a product
    console.log('Searching for "wireless headphones"...');
    const searchResult = await pc.fill('search box', 'wireless headphones');
    
    if (searchResult.success) {
        await pc.click('search button');
        await pc.waitForNavigation();
        
        // Extract search results
        console.log('Extracting search results...');
        const products = await pc.extractData({
            selector: 'product listing',
            fields: ['title', 'price', 'rating'],
            limit: 5
        });
        
        if (products.success && products.data) {
            console.log(`Found ${products.data.length} products:`);
            products.data.forEach((product: any, index: number) => {
                console.log(`  ${index + 1}. ${product.title || 'Unknown'} - ${product.price || 'N/A'}`);
            });
        }
        
        // Click on first product
        const clickResult = await pc.click('first product in search results');
        if (clickResult.success) {
            await pc.waitForNavigation();
            
            // Extract product details
            const details = await pc.extractData({
                selector: 'product details',
                fields: ['title', 'price', 'availability', 'description']
            });
            
            if (details.success && details.data) {
                console.log('\nProduct Details:');
                console.log('  Title:', details.data.title || 'N/A');
                console.log('  Price:', details.data.price || 'N/A');
                console.log('  Availability:', details.data.availability || 'N/A');
            }
            
            // Add to cart (demonstration only)
            console.log('\nAttempting to add to cart...');
            const addToCart = await pc.click('add to cart button');
            if (addToCart.success) {
                console.log('✓ Product added to cart');
                
                // Save cart state
                await pc.saveState('amazon-cart-state');
                console.log('✓ Cart state saved');
            }
        }
    }
}

/**
 * eBay automation example
 */
async function ebayExample(pc: PlayClone) {
    console.log('Navigating to eBay...');
    const navResult = await pc.navigate('https://www.ebay.com');
    
    if (!navResult.success) {
        console.error('Failed to navigate to eBay:', navResult.error);
        return;
    }
    
    // Search for a specific item
    console.log('Searching for "vintage camera"...');
    const searchResult = await pc.fill('search input', 'vintage camera');
    
    if (searchResult.success) {
        await pc.press('Enter');
        await pc.waitForNavigation();
        
        // Apply filters
        console.log('Applying filters...');
        await pc.click('Buy It Now filter');
        await pc.waitForContent();
        
        // Extract and compare prices
        console.log('Extracting price information...');
        const listings = await pc.extractTable({
            selector: 'search results',
            columns: ['title', 'price', 'condition', 'shipping']
        });
        
        if (listings.success && listings.data) {
            console.log(`Found ${listings.data.length} listings`);
            
            // Find best deal (lowest price + shipping)
            const pricesWithShipping = listings.data
                .filter((item: any) => item.price && item.shipping)
                .map((item: any) => {
                    const price = parseFloat(item.price.replace(/[^0-9.]/g, ''));
                    const shipping = item.shipping.toLowerCase() === 'free' ? 0 : 
                                   parseFloat(item.shipping.replace(/[^0-9.]/g, '') || '0');
                    return {
                        ...item,
                        totalPrice: price + shipping
                    };
                })
                .sort((a: any, b: any) => a.totalPrice - b.totalPrice);
            
            if (pricesWithShipping.length > 0) {
                const bestDeal = pricesWithShipping[0];
                console.log('\n🎯 Best Deal Found:');
                console.log(`  Title: ${bestDeal.title}`);
                console.log(`  Price: ${bestDeal.price}`);
                console.log(`  Shipping: ${bestDeal.shipping}`);
                console.log(`  Total: $${bestDeal.totalPrice.toFixed(2)}`);
            }
        }
        
        // Watch an item
        console.log('\nAdding first item to watchlist...');
        const watchResult = await pc.click('watch button on first item');
        if (watchResult.success) {
            console.log('✓ Item added to watchlist');
        }
    }
}

/**
 * Generic e-commerce pattern that works with most sites
 */
async function genericEcommerceExample(pc: PlayClone) {
    // This example uses a test e-commerce site
    console.log('Navigating to demo shop...');
    const navResult = await pc.navigate('https://www.saucedemo.com');
    
    if (!navResult.success) {
        console.error('Failed to navigate to demo shop:', navResult.error);
        return;
    }
    
    // Login to demo site
    console.log('Logging into demo account...');
    await pc.fill('username field', 'standard_user');
    await pc.fill('password field', 'secret_sauce');
    await pc.click('login button');
    await pc.waitForNavigation();
    
    // Browse products
    console.log('Browsing products...');
    const products = await pc.extractData({
        selector: 'product grid',
        fields: ['name', 'price', 'description']
    });
    
    if (products.success && products.data) {
        console.log(`Found ${products.data.length} products in catalog`);
    }
    
    // Add multiple items to cart
    console.log('\nAdding items to cart...');
    const itemsToAdd = ['Sauce Labs Backpack', 'Sauce Labs Bike Light', 'Sauce Labs Bolt T-Shirt'];
    
    for (const item of itemsToAdd) {
        const addResult = await pc.click(`add to cart button for "${item}"`);
        if (addResult.success) {
            console.log(`  ✓ Added ${item}`);
        }
    }
    
    // Check cart count
    const cartCount = await pc.getText('shopping cart badge');
    if (cartCount.success) {
        console.log(`\nCart now contains ${cartCount.data} items`);
    }
    
    // Navigate to cart
    console.log('\nNavigating to cart...');
    await pc.click('shopping cart');
    await pc.waitForNavigation();
    
    // Extract cart contents
    const cartItems = await pc.extractTable({
        selector: 'cart items',
        columns: ['quantity', 'name', 'price']
    });
    
    if (cartItems.success && cartItems.data) {
        console.log('\nCart Contents:');
        let total = 0;
        cartItems.data.forEach((item: any) => {
            const price = parseFloat(item.price?.replace(/[^0-9.]/g, '') || '0');
            const quantity = parseInt(item.quantity || '1');
            const subtotal = price * quantity;
            total += subtotal;
            console.log(`  ${quantity}x ${item.name} @ ${item.price} = $${subtotal.toFixed(2)}`);
        });
        console.log(`  Total: $${total.toFixed(2)}`);
    }
    
    // Proceed to checkout
    console.log('\nProceeding to checkout...');
    await pc.click('checkout button');
    await pc.waitForNavigation();
    
    // Fill checkout form
    console.log('Filling checkout information...');
    await pc.fill('first name', 'John');
    await pc.fill('last name', 'Doe');
    await pc.fill('postal code', '12345');
    await pc.click('continue button');
    await pc.waitForNavigation();
    
    // Review order
    console.log('Reviewing order...');
    const orderSummary = await pc.extractData({
        selector: 'checkout summary',
        fields: ['subtotal', 'tax', 'total']
    });
    
    if (orderSummary.success && orderSummary.data) {
        console.log('\nOrder Summary:');
        console.log(`  Subtotal: ${orderSummary.data.subtotal || 'N/A'}`);
        console.log(`  Tax: ${orderSummary.data.tax || 'N/A'}`);
        console.log(`  Total: ${orderSummary.data.total || 'N/A'}`);
    }
    
    // Complete order (demo only)
    console.log('\nCompleting order...');
    const finishResult = await pc.click('finish button');
    if (finishResult.success) {
        await pc.waitForNavigation();
        
        // Check for confirmation
        const confirmation = await pc.getText('order confirmation message');
        if (confirmation.success) {
            console.log(`\n✅ Order completed: ${confirmation.data}`);
        }
    }
    
    // Save session for later
    await pc.saveState('ecommerce-session');
    console.log('✓ Session saved for future use');
}

// Utility function to handle product comparison across sites
async function compareProductAcrossSites(pc: PlayClone, productName: string) {
    const results: any[] = [];
    
    // Define sites to check
    const sites = [
        { name: 'Amazon', url: 'https://www.amazon.com', searchBox: 'search field' },
        { name: 'eBay', url: 'https://www.ebay.com', searchBox: 'search input' },
        { name: 'Walmart', url: 'https://www.walmart.com', searchBox: 'search bar' }
    ];
    
    console.log(`\n🔍 Comparing prices for "${productName}" across sites...\n`);
    
    for (const site of sites) {
        console.log(`Checking ${site.name}...`);
        
        // Navigate to site
        const navResult = await pc.navigate(site.url);
        if (!navResult.success) {
            console.log(`  ❌ Could not access ${site.name}`);
            continue;
        }
        
        // Search for product
        await pc.fill(site.searchBox, productName);
        await pc.press('Enter');
        await pc.waitForContent();
        
        // Extract first result price
        const price = await pc.getText('first product price');
        if (price.success) {
            results.push({
                site: site.name,
                price: price.data
            });
            console.log(`  ✓ ${site.name}: ${price.data}`);
        } else {
            console.log(`  ❌ Could not find price on ${site.name}`);
        }
    }
    
    // Find best price
    if (results.length > 0) {
        console.log('\n📊 Price Comparison Results:');
        results.forEach(r => console.log(`  ${r.site}: ${r.price}`));
        
        // Simple comparison (would need proper price parsing in production)
        const lowest = results.reduce((min, r) => {
            const price = parseFloat(r.price.replace(/[^0-9.]/g, '') || '999999');
            const minPrice = parseFloat(min.price.replace(/[^0-9.]/g, '') || '999999');
            return price < minPrice ? r : min;
        });
        
        console.log(`\n🏆 Best price found on ${lowest.site}: ${lowest.price}`);
    }
    
    return results;
}

// Run the example if executed directly
if (require.main === module) {
    ecommerceAutomation().catch(console.error);
}

export { ecommerceAutomation, amazonExample, ebayExample, genericEcommerceExample, compareProductAcrossSites };