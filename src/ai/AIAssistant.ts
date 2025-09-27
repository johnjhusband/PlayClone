/**
 * AI Assistant Integration Module for PlayClone
 * Provides enhanced capabilities for AI assistants to control browsers
 */

import { PlayClone } from '../PlayClone';

export interface AISearchResult {
  success: boolean;
  results?: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  error?: string;
}

export interface AIFormData {
  [key: string]: string | boolean | number;
}

export class AIAssistant {
  private playclone: PlayClone;

  constructor(playclone: PlayClone) {
    this.playclone = playclone;
  }

  /**
   * Perform a search on any major search engine
   */
  async search(query: string, engine: 'google' | 'duckduckgo' | 'bing' = 'google'): Promise<AISearchResult> {
    const engines = {
      google: {
        url: 'https://www.google.com',
        searchSelector: 'search box, search input, query field',
        resultsSelector: 'search results, result links'
      },
      duckduckgo: {
        url: 'https://duckduckgo.com',
        searchSelector: 'search input, search box',
        resultsSelector: 'search results, result links'
      },
      bing: {
        url: 'https://www.bing.com',
        searchSelector: 'search box, search input',
        resultsSelector: 'search results, result links'
      }
    };

    const config = engines[engine];

    try {
      // Navigate to search engine
      await this.playclone.navigate(config.url);

      // Fill search box
      await this.playclone.fill(config.searchSelector, query);
      await this.playclone.press('Enter');

      // Wait for results
      await this.playclone.waitFor(config.resultsSelector, { timeout: 5000 });

      // Extract search results
      const results = await this.playclone.extractData({
        results: {
          selector: '.g, .result, [data-testid="result"]',
          multiple: true,
          fields: {
            title: { selector: 'h3, .result-title', attribute: 'text' },
            url: { selector: 'a', attribute: 'href' },
            snippet: { selector: '.snippet, .result-snippet, .st', attribute: 'text' }
          }
        }
      });

      return {
        success: true,
        results: results.results || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }

  /**
   * Fill out a form intelligently using natural language descriptions
   */
  async fillForm(formData: AIFormData): Promise<{ success: boolean; error?: string }> {
    try {
      for (const [field, value] of Object.entries(formData)) {
        // Use natural language to find form fields
        const selector = `${field} field, ${field} input, input for ${field}, ${field}`;

        if (typeof value === 'boolean') {
          // Handle checkboxes
          const checked = await this.playclone.isChecked(selector);
          if (checked !== value) {
            await this.playclone.click(selector);
          }
        } else {
          // Handle text inputs
          await this.playclone.fill(selector, String(value));
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Form filling failed'
      };
    }
  }

  /**
   * Extract structured data from any webpage
   */
  async extractPageData(dataSpec: any): Promise<any> {
    return await this.playclone.extractData(dataSpec);
  }

  /**
   * Summarize page content for AI consumption
   */
  async summarizePage(): Promise<{ title: string; summary: string; links: string[] }> {
    const title = await this.playclone.getTitle();
    const text = await this.playclone.getText();
    const links = await this.playclone.getLinks();

    // Create concise summary (first 500 chars)
    const summary = text.substring(0, 500).replace(/\s+/g, ' ').trim();

    return {
      title,
      summary,
      links: links.slice(0, 10) // Top 10 links
    };
  }

  /**
   * Navigate and interact with Single Page Applications
   */
  async interactWithSPA(actions: Array<{ action: string; target: string; value?: string }>): Promise<void> {
    for (const step of actions) {
      switch (step.action) {
        case 'click':
          await this.playclone.click(step.target);
          break;
        case 'fill':
          await this.playclone.fill(step.target, step.value || '');
          break;
        case 'wait':
          await this.playclone.waitFor(step.target);
          break;
        case 'hover':
          await this.playclone.hover(step.target);
          break;
        default:
          console.warn(`Unknown action: ${step.action}`);
      }

      // Small delay between actions for SPAs
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

export default AIAssistant;