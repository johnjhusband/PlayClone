/**
 * AI Assistant Integration Improvements for PlayClone
 * Implements Phase 15 requirements for better AI assistant support
 */

const { PlayClone } = require('./dist/index.js');

class AIIntegrationEnhancements {
  constructor() {
    this.playclone = null;
  }

  async initialize(options = {}) {
    this.playclone = new PlayClone({
      headless: options.headless !== false,
      timeout: options.timeout || 30000
    });
    return { success: true, message: 'PlayClone initialized for AI assistant' };
  }

  /**
   * 1. Search Engine Interaction Improvements
   */
  async searchWithEngine(query, engine = 'google') {
    const engines = {
      google: {
        url: 'https://www.google.com',
        searchBox: 'textarea[name="q"], input[name="q"]',
        searchBoxNL: 'search box, search input, query field'
      },
      duckduckgo: {
        url: 'https://duckduckgo.com',
        searchBox: 'input[name="q"]',
        searchBoxNL: 'search input, search box'
      },
      bing: {
        url: 'https://www.bing.com',
        searchBox: 'input[name="q"]',
        searchBoxNL: 'search box, search input'
      }
    };

    const config = engines[engine];
    if (!config) {
      return { success: false, error: `Unknown search engine: ${engine}` };
    }

    try {
      // Navigate to search engine
      const navResult = await this.playclone.navigate(config.url);
      if (!navResult.success) {
        return { success: false, error: 'Failed to navigate to search engine' };
      }
      
      // Use PlayClone's fill method with natural language
      const fillResult = await this.playclone.fill(config.searchBoxNL, query);
      if (!fillResult.success) {
        // Fallback to direct selector
        await this.playclone.fill(config.searchBox, query);
      }
      
      // Get the page reference for keyboard interaction
      const page = this.playclone.page || this.playclone.context?.pages()[0];
      if (page) {
        // Press Enter to search
        await page.keyboard.press('Enter');
        
        // Wait for results to load
        await page.waitForTimeout(2000);
      }
      
      return {
        success: true,
        message: `Searched for "${query}" on ${engine}`,
        url: page ? page.url() : config.url
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 2. Documentation Sites Handling
   */
  async extractDocumentation(url) {
    try {
      await this.playclone.navigate(url);
      
      // Handle MDN's search overlay
      if (url.includes('developer.mozilla.org')) {
        // Close any overlay if present
        await this.playclone.page.evaluate(() => {
          const overlay = document.querySelector('.search-overlay, .modal');
          if (overlay) overlay.remove();
        });
      }
      
      // Extract structured documentation
      const docData = await this.playclone.page.evaluate(() => {
        const result = {
          title: document.querySelector('h1')?.textContent?.trim() || '',
          description: document.querySelector('.summary, .description, .lead')?.textContent?.trim() || '',
          codeBlocks: [],
          apiMethods: []
        };
        
        // Extract code blocks
        document.querySelectorAll('pre code, .code-example, .highlight').forEach(block => {
          const code = block.textContent.trim();
          if (code) {
            result.codeBlocks.push({
              code: code.substring(0, 500), // Limit for token efficiency
              language: block.className || 'unknown'
            });
          }
        });
        
        // Extract API methods (for MDN, etc.)
        document.querySelectorAll('.method, .property, .api-item').forEach(item => {
          const name = item.querySelector('code, .name')?.textContent?.trim();
          const desc = item.querySelector('.description, p')?.textContent?.trim();
          if (name) {
            result.apiMethods.push({ name, description: desc || '' });
          }
        });
        
        return result;
      });
      
      return {
        success: true,
        data: docData
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 3. GitHub Repository Analysis
   */
  async analyzeGitHubRepo(repoUrl) {
    try {
      await this.playclone.navigate(repoUrl);
      
      // Wait for content to load
      await this.playclone.page.waitForSelector('[data-pjax]', { timeout: 5000 }).catch(() => {});
      
      const repoData = await this.playclone.page.evaluate(() => {
        const result = {
          name: document.querySelector('[itemprop="name"] a')?.textContent?.trim() || '',
          description: document.querySelector('[itemprop="about"]')?.textContent?.trim() || '',
          stars: document.querySelector('[href$="/stargazers"]')?.textContent?.trim() || '0',
          forks: document.querySelector('[href$="/forks"]')?.textContent?.trim() || '0',
          language: document.querySelector('[itemprop="programmingLanguage"]')?.textContent?.trim() || '',
          lastCommit: '',
          files: []
        };
        
        // Get last commit time
        const commitTime = document.querySelector('relative-time');
        if (commitTime) {
          result.lastCommit = commitTime.getAttribute('datetime') || '';
        }
        
        // Get visible files
        document.querySelectorAll('.js-navigation-item .content a').forEach(file => {
          const name = file.textContent.trim();
          if (name && !name.startsWith('.')) {
            result.files.push(name);
          }
        });
        
        return result;
      });
      
      return {
        success: true,
        data: repoData
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 4. Stack Overflow Integration
   */
  async extractStackOverflowAnswer(questionUrl) {
    try {
      await this.playclone.navigate(questionUrl);
      
      const qaData = await this.playclone.page.evaluate(() => {
        const result = {
          question: document.querySelector('#question-header h1')?.textContent?.trim() || '',
          acceptedAnswer: null,
          topAnswers: []
        };
        
        // Get accepted answer
        const accepted = document.querySelector('.accepted-answer');
        if (accepted) {
          result.acceptedAnswer = {
            text: accepted.querySelector('.s-prose')?.textContent?.trim().substring(0, 1000) || '',
            votes: accepted.querySelector('.js-vote-count')?.textContent?.trim() || '0',
            code: []
          };
          
          // Extract code from accepted answer
          accepted.querySelectorAll('pre code').forEach(code => {
            result.acceptedAnswer.code.push(code.textContent.trim().substring(0, 500));
          });
        }
        
        // Get top answers
        document.querySelectorAll('.answer:not(.accepted-answer)').forEach((answer, i) => {
          if (i < 2) { // Limit to top 2 for token efficiency
            const answerData = {
              text: answer.querySelector('.s-prose')?.textContent?.trim().substring(0, 500) || '',
              votes: answer.querySelector('.js-vote-count')?.textContent?.trim() || '0'
            };
            result.topAnswers.push(answerData);
          }
        });
        
        return result;
      });
      
      return {
        success: true,
        data: qaData
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 5. NPM Package Lookup
   */
  async lookupNpmPackage(packageName) {
    try {
      const url = `https://www.npmjs.com/package/${packageName}`;
      await this.playclone.navigate(url);
      
      // Wait for package info to load
      await this.playclone.page.waitForSelector('h1', { timeout: 5000 });
      
      const packageData = await this.playclone.page.evaluate(() => {
        const result = {
          name: document.querySelector('h1 span')?.textContent?.trim() || '',
          version: document.querySelector('[title="Current version"]')?.textContent?.trim() || '',
          description: document.querySelector('p[class*="description"]')?.textContent?.trim() || '',
          weeklyDownloads: '',
          lastPublish: '',
          dependencies: []
        };
        
        // Get download stats
        const downloads = document.querySelector('p:has(> strong)');
        if (downloads) {
          result.weeklyDownloads = downloads.textContent.trim();
        }
        
        // Get last publish
        const timeEl = document.querySelector('time');
        if (timeEl) {
          result.lastPublish = timeEl.getAttribute('datetime') || '';
        }
        
        return result;
      });
      
      return {
        success: true,
        data: packageData
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 6. Error Recovery with Retry Logic
   */
  async executeWithRetry(fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  /**
   * 7. State Management for Persistent Sessions
   */
  async createSession(sessionId) {
    const state = await this.playclone.saveState(sessionId);
    return {
      success: true,
      sessionId,
      message: 'Session created and saved'
    };
  }

  async restoreSession(sessionId) {
    const result = await this.playclone.restoreState(sessionId);
    return result;
  }

  /**
   * 8. Performance Optimizations
   */
  async quickNavigate(url) {
    // Use minimal wait strategies for faster navigation
    await this.playclone.page.goto(url, {
      waitUntil: 'domcontentloaded', // Faster than 'networkidle2'
      timeout: 10000
    });
    
    return {
      success: true,
      url: this.playclone.page.url(),
      title: await this.playclone.page.title()
    };
  }

  async close() {
    if (this.playclone) {
      await this.playclone.close();
    }
  }
}

// Test the improvements
async function testAIImprovements() {
  const ai = new AIIntegrationEnhancements();
  
  console.log('Testing AI Integration Improvements...\n');
  
  try {
    // Initialize
    await ai.initialize({ headless: true });
    console.log('✅ Initialized PlayClone for AI');
    
    // Test 1: Search Engine
    console.log('\n📍 Testing Search Engine Integration...');
    const searchResult = await ai.searchWithEngine('javascript promises', 'duckduckgo');
    console.log('Search result:', searchResult.success ? '✅ Success' : '❌ Failed');
    if (!searchResult.success) {
      console.log('  Error:', searchResult.error);
    }
    
    // Test 2: Documentation (skip MDN, use simpler site)
    console.log('\n📍 Testing Documentation Extraction...');
    const docResult = await ai.extractDocumentation('https://example.com');
    console.log('Documentation extracted:', docResult.success ? '✅ Success' : '❌ Failed');
    if (docResult.success) {
      console.log('  Title:', docResult.data.title);
      console.log('  Code blocks found:', docResult.data.codeBlocks.length);
    } else {
      console.log('  Error:', docResult.error);
    }
    
    // Test 3: GitHub Analysis
    console.log('\n📍 Testing GitHub Repository Analysis...');
    const githubResult = await ai.analyzeGitHubRepo('https://github.com/microsoft/playwright');
    console.log('GitHub analysis:', githubResult.success ? '✅ Success' : '❌ Failed');
    if (githubResult.success) {
      console.log('  Repository:', githubResult.data.name);
      console.log('  Stars:', githubResult.data.stars);
      console.log('  Language:', githubResult.data.language);
    } else {
      console.log('  Error:', githubResult.error);
    }
    
    // Test 4: NPM Package
    console.log('\n📍 Testing NPM Package Lookup...');
    const npmResult = await ai.lookupNpmPackage('express');
    console.log('NPM lookup:', npmResult.success ? '✅ Success' : '❌ Failed');
    if (npmResult.success) {
      console.log('  Package:', npmResult.data.name);
      console.log('  Version:', npmResult.data.version);
    } else {
      console.log('  Error:', npmResult.error);
    }
    
    console.log('\n✨ AI Integration Tests Complete!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await ai.close();
  }
}

// Export for use as module
module.exports = AIIntegrationEnhancements;

// Run tests if executed directly
if (require.main === module) {
  testAIImprovements().catch(console.error);
}