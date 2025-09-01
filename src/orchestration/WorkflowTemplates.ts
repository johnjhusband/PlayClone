import { Workflow } from './WorkflowOrchestrator';
import { WorkflowBuilder } from './WorkflowBuilder';

export class WorkflowTemplates {
  
  public static webScraping(): Workflow {
    return new WorkflowBuilder('web-scraping', 'Web Scraping Workflow')
      .description('Scrape data from multiple pages with pagination')
      .input('startUrl')
      .input('maxPages', 10)
      .variable('currentPage', 1)
      .variable('allData', [])
      
      .navigate('nav-1', '{{startUrl}}')
      .wait('wait-1', 2000)
      
      .loop('pagination', 'Paginate through results')
        .while('{{currentPage}} <= {{maxPages}}')
        .maxIterations(100)
        .do(builder => {
          builder
            .getText('extract-1', 'main')
            .action('store-data', 'Store extracted data', 'custom', {
              action: 'arrayPush',
              target: '{{allData}}',
              value: '{{extract-1.result}}'
            })
            .click('next-page', 'a[rel="next"]')
            .wait('wait-page', 1500)
            .action('increment', 'Increment page counter', 'custom', {
              action: 'increment',
              variable: 'currentPage'
            });
        })
        .end()
      
      .output('scrapedData', '{{allData}}')
      .output('pagesScraped', '{{currentPage}}')
      .build();
  }

  public static formSubmission(): Workflow {
    return new WorkflowBuilder('form-submission', 'Form Submission Workflow')
      .description('Fill and submit a form with validation')
      .input('formUrl')
      .input('formData')
      
      .navigate('nav-form', '{{formUrl}}')
      .wait('wait-load', 1000)
      
      .loop('fill-fields', 'Fill form fields')
        .forEach('{{formData}}', 'field')
        .do(builder => {
          builder.fill('fill-field', '{{field.key}}', '{{field.value}}');
        })
        .end()
      
      .click('submit', 'button[type="submit"]')
      .wait('wait-submit', 3000)
      
      .condition('check-success', 'Check submission success', '{{pageUrl}} != {{formUrl}}')
        .then(builder => {
          builder
            .getText('success-msg', '.success-message')
            .outputs({ successMessage: 'success-msg.result' });
        })
        .else(builder => {
          builder
            .getText('error-msg', '.error-message')
            .outputs({ errorMessage: 'error-msg.result' });
        })
        .end()
      
      .output('submitted', 'true')
      .build();
  }

  public static loginFlow(): Workflow {
    return new WorkflowBuilder('login-flow', 'Login Flow Workflow')
      .description('Automated login with 2FA support')
      .input('loginUrl')
      .input('username')
      .input('password')
      .input('totpSecret', null)
      
      .navigate('nav-login', '{{loginUrl}}')
      .wait('wait-login-page', 1000)
      
      .fill('enter-username', 'input[name="username"]', '{{username}}')
      .fill('enter-password', 'input[type="password"]', '{{password}}')
      .click('submit-login', 'button[type="submit"]')
      .wait('wait-auth', 2000)
      
      .condition('check-2fa', 'Check for 2FA', '{{totpSecret}} != null')
        .then(builder => {
          builder
            .action('generate-totp', 'Generate TOTP code', 'custom', {
              action: 'generateTotp',
              secret: '{{totpSecret}}'
            })
            .fill('enter-2fa', 'input[name="code"]', '{{generate-totp.result}}')
            .click('submit-2fa', 'button[type="submit"]')
            .wait('wait-2fa', 2000);
        })
        .end()
      
      .getText('user-name', '.user-name')
      .output('loggedInUser', '{{user-name.result}}')
      .output('loginSuccess', 'true')
      .build();
  }

  public static dataExtraction(): Workflow {
    return new WorkflowBuilder('data-extraction', 'Data Extraction Workflow')
      .description('Extract structured data from multiple sources')
      .input('sources')
      .variable('extractedData', {})
      
      .parallel('extract-parallel', 'Extract from multiple sources')
        .maxConcurrency(3)
        .waitForAll(false)
        .add(builder => {
          builder
            .loop('process-sources', 'Process each source')
              .forEach('{{sources}}', 'source')
              .do(b => {
                b
                  .navigate('nav-source', '{{source.url}}')
                  .wait('wait-source', 1000)
                  .action('extract', 'Extract data', 'custom', {
                    action: 'extract',
                    selectors: '{{source.selectors}}'
                  })
                  .action('store', 'Store extracted data', 'custom', {
                    action: 'store',
                    key: '{{source.id}}',
                    value: '{{extract.result}}'
                  });
              });
        })
        .end()
      
      .output('extractedData', '{{extractedData}}')
      .build();
  }

  public static monitoring(): Workflow {
    return new WorkflowBuilder('monitoring', 'Website Monitoring Workflow')
      .description('Monitor website availability and content changes')
      .input('url')
      .input('checkInterval', 60000)
      .input('selector', 'body')
      .variable('previousContent', null)
      .variable('status', 'unknown')
      
      .scheduleTrigger('*/5 * * * *') // Every 5 minutes
      
      .navigate('check-site', '{{url}}')
        .retry({ maxAttempts: 3, delay: 5000 })
        .timeout(30000)
        .continueOnError()
      
      .condition('check-loaded', 'Check if site loaded', '{{check-site.success}}')
        .then(builder => {
          builder
            .getText('get-content', '{{selector}}')
            .condition('check-change', 'Check for changes', '{{previousContent}} != null && {{get-content.result}} != {{previousContent}}')
              .then(b => {
                b.webhook('notify-change', 'Notify about change', '{{webhookUrl}}', {
                  type: 'contentChanged',
                  url: '{{url}}',
                  oldContent: '{{previousContent}}',
                  newContent: '{{get-content.result}}',
                  timestamp: '{{timestamp}}'
                });
              })
              .end()
            .action('update-content', 'Update previous content', 'custom', {
              action: 'set',
              variable: 'previousContent',
              value: '{{get-content.result}}'
            })
            .action('set-status', 'Set status to up', 'custom', {
              action: 'set',
              variable: 'status',
              value: 'up'
            });
        })
        .else(builder => {
          builder
            .action('set-status', 'Set status to down', 'custom', {
              action: 'set',
              variable: 'status',
              value: 'down'
            })
            .webhook('notify-down', 'Notify site down', '{{webhookUrl}}', {
              type: 'siteDown',
              url: '{{url}}',
              error: '{{check-site.error}}',
              timestamp: '{{timestamp}}'
            });
        })
        .end()
      
      .output('status', '{{status}}')
      .output('lastCheck', '{{timestamp}}')
      .build();
  }

  public static apiIntegration(): Workflow {
    return new WorkflowBuilder('api-integration', 'API Integration Workflow')
      .description('Fetch data from API and update website')
      .input('apiUrl')
      .input('apiKey')
      .input('targetUrl')
      .input('updateSelector')
      
      .webhook('fetch-api', 'Fetch from API', '{{apiUrl}}')
        .timeout(10000)
      
      .navigate('open-target', '{{targetUrl}}')
      .wait('wait-target', 1000)
      
      .loop('update-fields', 'Update fields with API data')
        .forEach('{{fetch-api.result.data}}', 'item')
        .do(builder => {
          builder
            .fill('update-field', '{{updateSelector}}', '{{item.value}}')
            .wait('wait-update', 500);
        })
        .end()
      
      .click('save', 'button.save')
      .wait('wait-save', 2000)
      
      .output('updated', 'true')
      .output('itemsUpdated', '{{fetch-api.result.data.length}}')
      .build();
  }

  public static e2eTesting(): Workflow {
    return new WorkflowBuilder('e2e-testing', 'E2E Testing Workflow')
      .description('End-to-end testing workflow with assertions')
      .input('baseUrl')
      .input('testCases')
      .variable('testResults', [])
      .variable('failedTests', 0)
      
      .loop('run-tests', 'Run test cases')
        .forEach('{{testCases}}', 'testCase')
        .do(builder => {
          builder
            .navigate('nav-test', '{{baseUrl}}{{testCase.path}}')
            .wait('wait-test', 1000)
            
            .loop('perform-actions', 'Perform test actions')
              .forEach('{{testCase.actions}}', 'action')
              .do(b => {
                b.action('execute', 'Execute action', '{{action.type}}', '{{action.params}}');
              })
              .end()
            
            .loop('check-assertions', 'Check assertions')
              .forEach('{{testCase.assertions}}', 'assertion')
              .do(b => {
                b
                  .getText('get-value', '{{assertion.selector}}')
                  .condition('assert', 'Check assertion', '{{get-value.result}} == {{assertion.expected}}')
                    .then(tb => {
                      tb.action('pass', 'Mark as passed', 'custom', {
                        action: 'arrayPush',
                        target: '{{testResults}}',
                        value: { test: '{{testCase.name}}', status: 'passed' }
                      });
                    })
                    .else(tb => {
                      tb
                        .action('fail', 'Mark as failed', 'custom', {
                          action: 'arrayPush',
                          target: '{{testResults}}',
                          value: { 
                            test: '{{testCase.name}}', 
                            status: 'failed',
                            expected: '{{assertion.expected}}',
                            actual: '{{get-value.result}}'
                          }
                        })
                        .action('increment-failed', 'Increment failed count', 'custom', {
                          action: 'increment',
                          variable: 'failedTests'
                        });
                    })
                    .end();
              })
              .end();
        })
        .end()
      
      .output('testResults', '{{testResults}}')
      .output('totalTests', '{{testCases.length}}')
      .output('failedTests', '{{failedTests}}')
      .output('passedTests', '{{testCases.length - failedTests}}')
      .build();
  }

  public static socialMediaPosting(): Workflow {
    return new WorkflowBuilder('social-media', 'Social Media Posting Workflow')
      .description('Post content to multiple social media platforms')
      .input('platforms')
      .input('content')
      .variable('postResults', [])
      
      .parallel('post-parallel', 'Post to platforms in parallel')
        .maxConcurrency(2)
        .waitForAll(true)
        .add(builder => {
          builder
            .loop('post-to-platforms', 'Post to each platform')
              .forEach('{{platforms}}', 'platform')
              .do(b => {
                b
                  .navigate('open-platform', '{{platform.url}}')
                  .wait('wait-platform', 2000)
                  
                  .condition('check-login', 'Check if logged in', '{{platform.requiresLogin}}')
                    .then(tb => {
                      tb
                        .fill('username', '{{platform.usernameSelector}}', '{{platform.username}}')
                        .fill('password', '{{platform.passwordSelector}}', '{{platform.password}}')
                        .click('login', '{{platform.loginButton}}')
                        .wait('wait-login', 3000);
                    })
                    .end()
                  
                  .click('new-post', '{{platform.newPostButton}}')
                  .wait('wait-compose', 1000)
                  .fill('content', '{{platform.contentSelector}}', '{{content.text}}')
                  
                  .condition('check-image', 'Check if image should be uploaded', '{{content.image}} != null')
                    .then(tb => {
                      tb.action('upload-image', 'Upload image', 'custom', {
                        action: 'uploadFile',
                        selector: '{{platform.imageSelector}}',
                        file: '{{content.image}}'
                      });
                    })
                    .end()
                  
                  .click('publish', '{{platform.publishButton}}')
                  .wait('wait-publish', 3000)
                  
                  .action('store-result', 'Store post result', 'custom', {
                    action: 'arrayPush',
                    target: '{{postResults}}',
                    value: {
                      platform: '{{platform.name}}',
                      status: 'posted',
                      timestamp: '{{timestamp}}'
                    }
                  });
              })
              .end();
        })
        .end()
      
      .output('postResults', '{{postResults}}')
      .output('platformsPosted', '{{postResults.length}}')
      .build();
  }

  public static approvalWorkflow(): Workflow {
    return new WorkflowBuilder('approval-workflow', 'Multi-Stage Approval Workflow')
      .description('Multi-stage approval process with notifications')
      .input('requestData')
      .input('approvalStages')
      .variable('currentStage', 0)
      .variable('approvalHistory', [])
      
      .loop('approval-stages', 'Process approval stages')
        .forEach('{{approvalStages}}', 'stage')
        .do(builder => {
          builder
            .webhook('notify-approvers', 'Notify approvers', '{{stage.notificationUrl}}', {
              type: 'approvalRequest',
              stage: '{{stage.name}}',
              data: '{{requestData}}',
              approvers: '{{stage.approvers}}'
            })
            
            .approval('get-approval', 'Wait for approval', ['{{stage.approvers}}'], '{{stage.message}}')
              .timeout(86400000) // 24 hours
              .continueOnError()
            
            .condition('check-approval', 'Check if approved', '{{get-approval.approved}}')
              .then(tb => {
                tb
                  .action('record-approval', 'Record approval', 'custom', {
                    action: 'arrayPush',
                    target: '{{approvalHistory}}',
                    value: {
                      stage: '{{stage.name}}',
                      approved: true,
                      timestamp: '{{timestamp}}'
                    }
                  })
                  .action('increment-stage', 'Move to next stage', 'custom', {
                    action: 'increment',
                    variable: 'currentStage'
                  });
              })
              .else(tb => {
                tb
                  .action('record-rejection', 'Record rejection', 'custom', {
                    action: 'arrayPush',
                    target: '{{approvalHistory}}',
                    value: {
                      stage: '{{stage.name}}',
                      approved: false,
                      timestamp: '{{timestamp}}'
                    }
                  })
                  .webhook('notify-rejection', 'Notify rejection', '{{stage.notificationUrl}}', {
                    type: 'approvalRejected',
                    stage: '{{stage.name}}',
                    data: '{{requestData}}'
                  })
                  .action('stop-workflow', 'Stop workflow', 'custom', {
                    action: 'throw',
                    error: 'Approval rejected at stage {{stage.name}}'
                  });
              })
              .end();
        })
        .end()
      
      .webhook('notify-completion', 'Notify completion', '{{completionUrl}}', {
        type: 'approvalCompleted',
        data: '{{requestData}}',
        history: '{{approvalHistory}}'
      })
      
      .output('approved', 'true')
      .output('approvalHistory', '{{approvalHistory}}')
      .output('completedStages', '{{currentStage}}')
      .build();
  }

  public static getTemplate(name: string): Workflow | null {
    const templates: Record<string, () => Workflow> = {
      'web-scraping': this.webScraping,
      'form-submission': this.formSubmission,
      'login-flow': this.loginFlow,
      'data-extraction': this.dataExtraction,
      'monitoring': this.monitoring,
      'api-integration': this.apiIntegration,
      'e2e-testing': this.e2eTesting,
      'social-media': this.socialMediaPosting,
      'approval-workflow': this.approvalWorkflow
    };

    const templateFn = templates[name];
    return templateFn ? templateFn() : null;
  }

  public static listTemplates(): string[] {
    return [
      'web-scraping',
      'form-submission',
      'login-flow',
      'data-extraction',
      'monitoring',
      'api-integration',
      'e2e-testing',
      'social-media',
      'approval-workflow'
    ];
  }
}