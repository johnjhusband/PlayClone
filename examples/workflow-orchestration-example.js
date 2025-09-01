const { PlayClone, WorkflowOrchestrator, WorkflowBuilder, WorkflowTemplates } = require('../dist/index');

async function demonstrateWorkflowOrchestration() {
  console.log('🎭 PlayClone Workflow Orchestration Demo\n');
  console.log('=' .repeat(50));

  const playclone = new PlayClone({ headless: false });
  const orchestrator = new WorkflowOrchestrator(playclone);

  try {
    await orchestrator.initialize();
    console.log('✅ Workflow orchestrator initialized\n');

    // Example 1: Simple Sequential Workflow
    console.log('1️⃣ Creating Simple Sequential Workflow');
    console.log('-'.repeat(40));
    
    const simpleWorkflow = new WorkflowBuilder('simple-search', 'Simple Search Workflow')
      .description('Search for a term and extract results')
      .input('searchTerm', 'PlayClone browser automation')
      .navigate('open-search', 'https://duckduckgo.com')
      .wait('wait-load', 2000)
      .fill('enter-search', 'input[name="q"]', '{{searchTerm}}')
      .click('submit-search', 'button[type="submit"]')
      .wait('wait-results', 3000)
      .getText('get-results', '#links')
      .screenshot('capture-results', { fullPage: false })
      .output('searchResults', '{{get-results.result}}')
      .build();

    orchestrator.registerWorkflow(simpleWorkflow);
    console.log('✅ Simple workflow registered\n');

    // Example 2: Conditional Workflow
    console.log('2️⃣ Creating Conditional Workflow');
    console.log('-'.repeat(40));
    
    const conditionalWorkflow = new WorkflowBuilder('conditional-nav', 'Conditional Navigation')
      .description('Navigate based on conditions')
      .input('preferredSite', 'github')
      .variable('siteUrl', '')
      
      .condition('check-site', 'Choose site based on preference', '{{preferredSite}} == "github"')
        .then(builder => {
          builder
            .navigate('nav-github', 'https://github.com')
            .action('set-url', 'Set site URL', 'custom', {
              action: 'set',
              variable: 'siteUrl',
              value: 'github.com'
            });
        })
        .else(builder => {
          builder
            .navigate('nav-example', 'https://example.com')
            .action('set-url', 'Set site URL', 'custom', {
              action: 'set',
              variable: 'siteUrl',
              value: 'example.com'
            });
        })
        .end()
      
      .getText('get-title', 'title')
      .output('visitedSite', '{{siteUrl}}')
      .output('pageTitle', '{{get-title.result}}')
      .build();

    orchestrator.registerWorkflow(conditionalWorkflow);
    console.log('✅ Conditional workflow registered\n');

    // Example 3: Loop Workflow
    console.log('3️⃣ Creating Loop Workflow');
    console.log('-'.repeat(40));
    
    const loopWorkflow = new WorkflowBuilder('multi-search', 'Multi-Site Search')
      .description('Search multiple sites for information')
      .input('searchTerms', ['browser automation', 'web scraping', 'test automation'])
      .variable('results', [])
      
      .loop('search-loop', 'Search for each term')
        .forEach('{{searchTerms}}', 'term')
        .maxIterations(5)
        .do(builder => {
          builder
            .navigate('open-duckduckgo', 'https://duckduckgo.com')
            .wait('wait-ddg', 1500)
            .fill('search-term', 'input[name="q"]', '{{term}}')
            .click('search-button', 'button[type="submit"]')
            .wait('wait-search-results', 2000)
            .getText('extract-title', 'h2:first-of-type')
            .action('store-result', 'Store search result', 'custom', {
              action: 'arrayPush',
              target: '{{results}}',
              value: { term: '{{term}}', firstResult: '{{extract-title.result}}' }
            });
        })
        .end()
      
      .output('searchResults', '{{results}}')
      .output('termsSearched', '{{searchTerms.length}}')
      .build();

    orchestrator.registerWorkflow(loopWorkflow);
    console.log('✅ Loop workflow registered\n');

    // Example 4: Parallel Workflow
    console.log('4️⃣ Creating Parallel Workflow');
    console.log('-'.repeat(40));
    
    const parallelWorkflow = new WorkflowBuilder('parallel-extract', 'Parallel Data Extraction')
      .description('Extract data from multiple sites in parallel')
      .variable('extractedData', {})
      
      .parallel('extract-parallel', 'Extract from multiple sites')
        .maxConcurrency(3)
        .waitForAll(false)
        .add(builder => {
          builder
            .navigate('nav-example', 'https://example.com')
            .getText('get-example-title', 'h1')
            .action('store-example', 'Store example data', 'custom', {
              action: 'set',
              path: '{{extractedData.example}}',
              value: '{{get-example-title.result}}'
            })
            
            .navigate('nav-github', 'https://github.com')
            .getText('get-github-title', 'h1')
            .action('store-github', 'Store GitHub data', 'custom', {
              action: 'set',
              path: '{{extractedData.github}}',
              value: '{{get-github-title.result}}'
            })
            
            .navigate('nav-w3', 'https://www.w3.org')
            .getText('get-w3-title', 'h1')
            .action('store-w3', 'Store W3 data', 'custom', {
              action: 'set',
              path: '{{extractedData.w3}}',
              value: '{{get-w3-title.result}}'
            });
        })
        .end()
      
      .output('extractedData', '{{extractedData}}')
      .build();

    orchestrator.registerWorkflow(parallelWorkflow);
    console.log('✅ Parallel workflow registered\n');

    // Example 5: Using Templates
    console.log('5️⃣ Using Workflow Templates');
    console.log('-'.repeat(40));
    
    const availableTemplates = WorkflowTemplates.listTemplates();
    console.log('Available templates:', availableTemplates.join(', '));
    
    const scrapingTemplate = WorkflowTemplates.webScraping();
    orchestrator.registerWorkflow(scrapingTemplate);
    console.log('✅ Web scraping template registered\n');

    // Execute a workflow
    console.log('📊 Executing Simple Search Workflow');
    console.log('-'.repeat(40));
    
    // Listen to workflow events
    orchestrator.on('executionStarted', (executionId) => {
      console.log(`🚀 Execution started: ${executionId}`);
    });
    
    orchestrator.on('stepStarted', (executionId, stepId) => {
      console.log(`  ▶️ Step started: ${stepId}`);
    });
    
    orchestrator.on('stepCompleted', (executionId, stepId) => {
      console.log(`  ✅ Step completed: ${stepId}`);
    });
    
    orchestrator.on('executionCompleted', (executionId) => {
      console.log(`🎉 Execution completed: ${executionId}`);
    });
    
    orchestrator.on('executionFailed', (executionId, error) => {
      console.error(`❌ Execution failed: ${executionId}`, error);
    });

    const execution = await orchestrator.executeWorkflow('simple-search', {
      searchTerm: 'AI browser automation'
    });

    console.log('\n📋 Execution Results:');
    console.log(`  Status: ${execution.status}`);
    console.log(`  Duration: ${execution.endTime - execution.startTime}ms`);
    console.log(`  Steps executed: ${execution.history.length}`);
    
    if (execution.outputs && execution.outputs.searchResults) {
      console.log(`  Results found: ${execution.outputs.searchResults ? 'Yes' : 'No'}`);
    }

    // Show workflow information
    console.log('\n📚 Registered Workflows:');
    const workflows = orchestrator.getWorkflows();
    workflows.forEach(workflow => {
      console.log(`  - ${workflow.name} (${workflow.id})`);
      if (workflow.description) {
        console.log(`    ${workflow.description}`);
      }
    });

    // Advanced: Create a complex workflow with all features
    console.log('\n6️⃣ Creating Complex Workflow with All Features');
    console.log('-'.repeat(40));
    
    const complexWorkflow = new WorkflowBuilder('complex-automation', 'Complex Automation Workflow')
      .description('Demonstrates all workflow features')
      .input('sites', ['https://example.com', 'https://github.com'])
      .variable('processedSites', 0)
      .variable('errors', [])
      
      // Add retry policy to the next action
      .navigate('initial-nav', 'https://example.com')
        .retry({ maxAttempts: 3, delay: 1000, backoffMultiplier: 2 })
        .timeout(10000)
        .continueOnError(true)
      
      // Conditional branching
      .condition('check-loaded', 'Check if page loaded', '{{initial-nav.success}}')
        .then(builder => {
          builder
            .getText('get-content', 'body')
            .outputs({ pageContent: 'get-content.result' });
        })
        .else(builder => {
          builder
            .action('log-error', 'Log navigation error', 'custom', {
              action: 'arrayPush',
              target: '{{errors}}',
              value: 'Failed to load initial page'
            });
        })
        .end()
      
      // Loop through sites
      .loop('process-sites', 'Process each site')
        .forEach('{{sites}}', 'site')
        .do(builder => {
          builder
            .navigate('nav-site', '{{site}}')
            .wait('wait-site', 1000)
            .screenshot('capture-site')
            .action('increment-counter', 'Increment processed sites', 'custom', {
              action: 'increment',
              variable: 'processedSites'
            });
        })
        .end()
      
      // Parallel execution
      .parallel('parallel-tasks', 'Execute tasks in parallel')
        .maxConcurrency(2)
        .add(builder => {
          builder
            .action('task1', 'First parallel task', 'wait', { duration: 1000 })
            .action('task2', 'Second parallel task', 'wait', { duration: 1000 })
            .action('task3', 'Third parallel task', 'wait', { duration: 1000 });
        })
        .end()
      
      .output('totalProcessed', '{{processedSites}}')
      .output('errors', '{{errors}}')
      .build();

    orchestrator.registerWorkflow(complexWorkflow);
    console.log('✅ Complex workflow registered');
    
    console.log('\n✨ Workflow Orchestration Demo Complete!');
    console.log('The orchestrator can now execute these workflows on demand,');
    console.log('via schedules, webhooks, or event triggers.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await playclone.close();
    orchestrator.cleanup();
    console.log('\n👋 Demo finished - browser closed');
  }
}

// Run the demo
demonstrateWorkflowOrchestration().catch(console.error);