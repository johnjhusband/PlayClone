/**
 * AI Assistant Integration Example
 * Shows how an AI assistant would use PlayClone
 */

import { PlayClone } from '../src/index';
import { ActionResult } from '../src/types';

/**
 * Example AI assistant class that uses PlayClone
 */
class AIAssistant {
  private browser: PlayClone;
  private context: any;

  constructor() {
    this.browser = new PlayClone({
      headless: true,
      browser: 'chromium',
      viewport: { width: 1280, height: 720 },
    });
  }

  /**
   * Initialize the browser
   */
  async initialize(): Promise<ActionResult> {
    const result = await this.browser.init();
    this.context = this.browser.getContext();
    return result;
  }

  /**
   * Execute a user command using natural language
   */
  async executeCommand(command: string): Promise<ActionResult> {
    // Parse natural language commands
    const lowerCommand = command.toLowerCase();

    // Navigation commands
    if (lowerCommand.includes('go to') || lowerCommand.includes('navigate to')) {
      const url = this.extractUrl(command);
      return await this.context.navigate(url);
    }

    // Click commands
    if (lowerCommand.includes('click')) {
      const target = this.extractClickTarget(command);
      return await this.context.click(target);
    }

    // Fill form commands
    if (lowerCommand.includes('fill') || lowerCommand.includes('type')) {
      const { field, value } = this.extractFillData(command);
      return await this.context.fill(field, value);
    }

    // Data extraction commands
    if (lowerCommand.includes('get text') || lowerCommand.includes('extract text')) {
      return await this.context.getText();
    }

    if (lowerCommand.includes('get links')) {
      return await this.context.getLinks();
    }

    if (lowerCommand.includes('screenshot')) {
      return await this.context.screenshot({ fullPage: true });
    }

    // Default response
    return {
      success: false,
      action: 'unknown',
      error: `Unknown command: ${command}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Extract URL from command
   */
  private extractUrl(command: string): string {
    // Simple extraction - in real AI, this would be more sophisticated
    const urlMatch = command.match(/(?:to|visit)\s+(.+)/i);
    if (urlMatch) {
      let url = urlMatch[1].trim();
      // Add protocol if missing
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      return url;
    }
    return 'https://www.google.com';
  }

  /**
   * Extract click target from command
   */
  private extractClickTarget(command: string): string {
    // Extract text after "click" or "click on"
    const targetMatch = command.match(/click(?:\s+on)?\s+(.+)/i);
    return targetMatch ? targetMatch[1].trim() : 'button';
  }

  /**
   * Extract form fill data from command
   */
  private extractFillData(command: string): { field: string; value: string } {
    // Simple pattern matching - real AI would use NLP
    const fillMatch = command.match(/(?:fill|type)\s+"([^"]+)"\s+(?:in|into)\s+(.+)/i);
    if (fillMatch) {
      return {
        value: fillMatch[1],
        field: fillMatch[2].trim(),
      };
    }
    
    // Alternative pattern
    const altMatch = command.match(/(?:fill|type)\s+(.+)\s+with\s+"([^"]+)"/i);
    if (altMatch) {
      return {
        field: altMatch[1].trim(),
        value: altMatch[2],
      };
    }

    return { field: 'input', value: '' };
  }

  /**
   * Close the browser
   */
  async cleanup(): Promise<void> {
    await this.browser.close();
  }
}

/**
 * Example usage simulating AI assistant interactions
 */
async function simulateAIInteraction() {
  const assistant = new AIAssistant();

  try {
    // Initialize
    console.log('Initializing AI Assistant...');
    await assistant.initialize();

    // Simulate user commands
    const commands = [
      'go to example.com',
      'get text',
      'click More information',
      'fill "John Doe" in name field',
      'take a screenshot',
      'get links',
    ];

    for (const command of commands) {
      console.log(`\n> User: "${command}"`);
      const result = await assistant.executeCommand(command);
      
      // Format response for minimal tokens
      const response = {
        success: result.success,
        action: result.action,
        ...(result.error && { error: result.error }),
        ...(result.value && { data: typeof result.value === 'string' 
          ? result.value.substring(0, 100) 
          : result.value }),
      };
      
      console.log('< Assistant:', JSON.stringify(response, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await assistant.cleanup();
    console.log('\nSession ended');
  }
}

// Run the simulation
simulateAIInteraction().catch(console.error);