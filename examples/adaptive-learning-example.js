const { PlayClone } = require('../dist/index');
const { AdaptiveLearningEngine } = require('../dist/ai/AdaptiveLearningEngine');

/**
 * Adaptive Learning Example
 * 
 * This example demonstrates how PlayClone can learn from user corrections
 * to improve selector accuracy and optimize action sequences over time.
 */

async function main() {
    console.log('🤖 PlayClone Adaptive Learning Example\n');
    
    // Initialize PlayClone with adaptive learning
    const pc = new PlayClone({ 
        headless: false,
        viewport: { width: 1280, height: 720 }
    });
    
    // Initialize the adaptive learning engine
    const learningEngine = new AdaptiveLearningEngine('./learning-model.json');
    
    try {
        // Example 1: Learning from selector corrections
        console.log('📚 Example 1: Learning from Selector Corrections\n');
        
        await pc.navigate('https://example.com');
        
        // Simulate an initial failed attempt with a poor selector
        const originalAction = {
            type: 'click',
            selector: 'div.button', // Too generic
            result: false,
            confidence: 0.3
        };
        
        // User provides a better selector
        const userCorrection = {
            type: 'click',
            selector: 'button#submit-form', // More specific
            result: true,
            confidence: 0.9,
            elementInfo: {
                tag: 'button',
                text: 'Submit',
                attributes: {
                    id: 'submit-form',
                    class: 'btn btn-primary',
                    type: 'submit'
                },
                visible: true
            }
        };
        
        // Record the correction for learning
        await learningEngine.recordCorrection(
            originalAction,
            userCorrection,
            pc.page
        );
        
        console.log('✅ Recorded user correction for better selector\n');
        
        // Example 2: Getting improved selector suggestions
        console.log('📚 Example 2: Getting Improved Selector Suggestions\n');
        
        const elementInfo = {
            tag: 'button',
            text: 'More information',
            attributes: {
                id: 'more-info',
                class: 'btn link-style',
                'aria-label': 'Learn more about our services'
            },
            visible: true
        };
        
        const context = {
            url: 'https://example.com',
            title: 'Example Domain',
            domain: 'example.com',
            pageType: 'general'
        };
        
        const suggestion = await learningEngine.suggestSelector(elementInfo, context);
        
        console.log('🎯 Suggested selector:', suggestion.selector);
        console.log('📊 Confidence:', (suggestion.confidence * 100).toFixed(1) + '%');
        console.log('🔄 Alternative selectors:', suggestion.alternatives);
        console.log();
        
        // Example 3: Optimizing action sequences
        console.log('📚 Example 3: Optimizing Action Sequences\n');
        
        const actions = [
            { type: 'click', selector: '#search-button', result: true },
            { type: 'wait', value: 1000, result: true }, // Unnecessary wait
            { type: 'click', selector: '#search-button', result: true }, // Duplicate click
            { type: 'fill', selector: '#search-input', value: 'test', result: true },
            { type: 'click', selector: '#submit', result: true }
        ];
        
        console.log('Original sequence:', actions.map(a => a.type).join(' → '));
        
        const optimized = await learningEngine.optimizeActionSequence(actions, context);
        
        console.log('Optimized sequence:', optimized.map(a => a.type).join(' → '));
        console.log('Reduced from', actions.length, 'to', optimized.length, 'actions\n');
        
        // Example 4: Confidence scoring
        console.log('📚 Example 4: Action Confidence Scoring\n');
        
        const testActions = [
            { type: 'click', selector: '#known-good-button' },
            { type: 'fill', selector: '.unknown-field' },
            { type: 'navigate', value: 'https://example.com' }
        ];
        
        for (const action of testActions) {
            const confidence = learningEngine.getActionConfidence(action, context);
            console.log(`Action: ${action.type} → Confidence: ${(confidence * 100).toFixed(1)}%`);
        }
        console.log();
        
        // Example 5: Learning statistics
        console.log('📚 Example 5: Learning Statistics\n');
        
        const stats = learningEngine.getStatistics();
        
        console.log('📊 Learning Model Statistics:');
        console.log('  Total corrections:', stats.totalCorrections);
        console.log('  Unique selectors learned:', stats.uniqueSelectors);
        console.log('  Action patterns discovered:', stats.uniquePatterns);
        console.log('  Domains learned from:', stats.domainsLearned);
        console.log('  Global confidence:', (stats.globalConfidence * 100).toFixed(1) + '%');
        
        if (stats.topSelectors.length > 0) {
            console.log('\n  Top performing selectors:');
            stats.topSelectors.slice(0, 3).forEach((s, i) => {
                console.log(`    ${i + 1}. ${s.selector} (${(s.successRate * 100).toFixed(1)}% success)`);
            });
        }
        
        if (stats.topPatterns.length > 0) {
            console.log('\n  Top action patterns:');
            stats.topPatterns.slice(0, 3).forEach((p, i) => {
                console.log(`    ${i + 1}. ${p.pattern} (${(p.successRate * 100).toFixed(1)}% success)`);
            });
        }
        
        // Example 6: Simulating continuous learning
        console.log('\n📚 Example 6: Continuous Learning Simulation\n');
        
        // Simulate multiple corrections to show learning improvement
        const selectors = [
            { bad: 'div', good: '#specific-div', effectiveness: 0.7 },
            { bad: '.button', good: 'button[type="submit"]', effectiveness: 0.8 },
            { bad: 'span', good: '[aria-label="Close"]', effectiveness: 0.9 }
        ];
        
        for (const [index, correction] of selectors.entries()) {
            const original = {
                type: 'click',
                selector: correction.bad,
                result: false,
                confidence: 0.2
            };
            
            const corrected = {
                type: 'click',
                selector: correction.good,
                result: true,
                confidence: 0.9
            };
            
            await learningEngine.recordCorrection(original, corrected, pc.page);
            
            console.log(`  Correction ${index + 1}: "${correction.bad}" → "${correction.good}"`);
        }
        
        const finalStats = learningEngine.getStatistics();
        console.log(`\n  After ${selectors.length} corrections:`);
        console.log(`  Global confidence improved to: ${(finalStats.globalConfidence * 100).toFixed(1)}%`);
        console.log(`  Learned ${finalStats.uniqueSelectors} unique selectors`);
        
        // Save the model for future use
        learningEngine.saveModel();
        console.log('\n💾 Learning model saved for future sessions');
        
        console.log('\n✅ Adaptive learning demonstration complete!');
        
    } catch (error) {
        console.error('❌ Error during adaptive learning demo:', error.message);
    } finally {
        // Clean up
        learningEngine.destroy();
        await pc.close();
    }
}

// Bonus: Example of integrating learning into automation workflow
async function automationWithLearning() {
    console.log('\n🔄 Bonus: Automation with Integrated Learning\n');
    
    const pc = new PlayClone({ headless: false });
    const learningEngine = new AdaptiveLearningEngine();
    
    try {
        await pc.navigate('https://github.com');
        
        // Get suggested selector for search box
        const searchElement = {
            tag: 'input',
            attributes: {
                type: 'text',
                placeholder: 'Search GitHub',
                name: 'q'
            },
            visible: true
        };
        
        const context = {
            url: 'https://github.com',
            title: 'GitHub',
            domain: 'github.com',
            pageType: 'search'
        };
        
        const suggestion = await learningEngine.suggestSelector(searchElement, context);
        
        console.log('🔍 Using learned selector:', suggestion.selector);
        console.log('   with confidence:', (suggestion.confidence * 100).toFixed(1) + '%');
        
        // Try the suggested selector
        const fillResult = await pc.fill(suggestion.selector, 'PlayClone');
        
        if (fillResult.success) {
            console.log('✅ Successfully used learned selector!');
            
            // Record successful usage
            await learningEngine.recordCorrection(
                { type: 'fill', selector: 'input', result: false, confidence: 0.3 },
                { type: 'fill', selector: suggestion.selector, result: true, confidence: suggestion.confidence },
                pc.page
            );
        } else if (suggestion.alternatives.length > 0) {
            console.log('⚠️ Primary selector failed, trying alternatives...');
            
            for (const alt of suggestion.alternatives) {
                const altResult = await pc.fill(alt, 'PlayClone');
                if (altResult.success) {
                    console.log('✅ Alternative selector worked:', alt);
                    
                    // Learn from this success
                    await learningEngine.recordCorrection(
                        { type: 'fill', selector: suggestion.selector, result: false },
                        { type: 'fill', selector: alt, result: true },
                        pc.page
                    );
                    break;
                }
            }
        }
        
        console.log('\n🎯 Adaptive learning helps improve automation reliability over time!');
        
    } finally {
        learningEngine.destroy();
        await pc.close();
    }
}

// Run the examples
(async () => {
    await main();
    await automationWithLearning();
})().catch(console.error);