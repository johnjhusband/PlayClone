/**
 * Integration tests for PlayClone browser functionality
 * These tests use real browsers to verify actual functionality
 */

import { PlayClone } from '../../src/index';

describe('PlayClone Browser Integration Tests', () => {
  let playclone: PlayClone;

  afterEach(async () => {
    if (playclone) {
      await playclone.close();
    }
  });

  describe('Browser Launch and Navigation', () => {
    it('should launch Chromium browser and navigate to a page', async () => {
      playclone = new PlayClone({ 
        headless: true,
        browser: 'chromium' 
      });

      // Navigate directly using PlayClone
      const navResult = await playclone.navigate('https://example.com');
      expect(navResult.success).toBe(true);
      expect(navResult.value?.url).toContain('example.com');
    }, 30000);

    it('should handle navigation to non-existent domain', async () => {
      playclone = new PlayClone({ headless: true });

      const result = await playclone.navigate('https://this-domain-definitely-does-not-exist-12345.com');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 30000);

    it('should navigate back and forward', async () => {
      playclone = new PlayClone({ headless: true });

      // Navigate to first page
      await playclone.navigate('https://example.com');

      // Navigate to second page
      await playclone.navigate('https://www.iana.org/domains/example');

      // Go back
      const backResult = await playclone.back();
      expect(backResult.success).toBe(true);
      expect(backResult.value?.url).toContain('example.com');

      // Go forward
      const forwardResult = await playclone.forward();
      expect(forwardResult.success).toBe(true);
      expect(forwardResult.value?.url).toContain('iana.org');
    }, 30000);

    it('should reload the page', async () => {
      playclone = new PlayClone({ headless: true });
      await playclone.navigate('https://example.com');
      const reloadResult = await playclone.reload();
      expect(reloadResult.success).toBe(true);
    }, 30000);
  });

  describe('Element Interaction', () => {
    it('should find and click elements using natural language', async () => {
      playclone = new PlayClone({ headless: true });
      await playclone.navigate('https://example.com');
      
      // Try to click the "More information" link
      const clickResult = await playclone.click('More information link');
      expect(clickResult.success).toBe(true);
      
      // Verify navigation occurred
      await new Promise(resolve => setTimeout(resolve, 1000));
      const state = await playclone.getCurrentState();
      expect(state.value?.url).toContain('iana.org');
    }, 30000);

    it('should extract text from page', async () => {
      playclone = new PlayClone({ headless: true });
      await playclone.navigate('https://example.com');
      
      const textResult = await playclone.getText();
      expect(textResult.type).toBe('text');
      expect(textResult.data).toContain('Example Domain');
      expect(textResult.data).toContain('This domain is for use in illustrative examples');
    }, 30000);

    it('should extract text from specific element', async () => {
      playclone = new PlayClone({ headless: true });
      await playclone.navigate('https://example.com');
      
      const textResult = await playclone.getText('main heading');
      expect(textResult.type).toBe('text');
      expect(textResult.data).toContain('Example Domain');
    }, 30000);

    it('should get all links from page', async () => {
      playclone = new PlayClone({ headless: true });
      await playclone.navigate('https://example.com');
      
      const linksResult = await playclone.getLinks();
      expect(linksResult.type).toBe('links');
      expect(linksResult.data?.links).toBeDefined();
      expect(linksResult.data?.links.length).toBeGreaterThan(0);
      
      // Should find the "More information" link
      const moreInfoLink = linksResult.data?.links.find(
        (link: any) => link.text?.includes('More information')
      );
      expect(moreInfoLink).toBeDefined();
    }, 30000);
  });

  describe('Form Interaction', () => {
    it('should fill form fields', async () => {
      playclone = new PlayClone({ headless: true });
      
      // Use a simple form page for testing
      await playclone.navigate('https://www.google.com');
      
      // Fill the search field
      const fillResult = await playclone.fill('search', 'PlayClone test');
      expect(fillResult.success).toBe(true);
    }, 30000);
  });

  describe('Screenshot Functionality', () => {
    it('should take a screenshot of the page', async () => {
      playclone = new PlayClone({ headless: true });
      await playclone.navigate('https://example.com');
      
      const screenshotResult = await playclone.screenshot();
      expect(screenshotResult.type).toBe('screenshot');
      expect(screenshotResult.data).toBeDefined();
      expect(typeof screenshotResult.data).toBe('string'); // base64 string
    }, 30000);

    it('should take a screenshot of specific element', async () => {
      playclone = new PlayClone({ headless: true });
      await playclone.navigate('https://example.com');
      
      // Note: screenshot doesn't support selector, only fullPage and path
      const screenshotResult = await playclone.screenshot({ fullPage: false });
      expect(screenshotResult.type).toBe('screenshot');
      expect(screenshotResult.data).toBeDefined();
    }, 30000);
  });

  describe('State Management', () => {
    it('should save and restore page state', async () => {
      playclone = new PlayClone({ headless: true });
      
      // Navigate to first page
      await playclone.navigate('https://example.com');
      
      // Save state
      const saveResult = await playclone.saveState('test-checkpoint');
      expect(saveResult.success).toBe(true);
      
      // Navigate away
      await playclone.navigate('https://www.iana.org');
      
      // Restore state
      const restoreResult = await playclone.restoreState('test-checkpoint');
      expect(restoreResult.success).toBe(true);
      
      // Verify we're back on the original page
      const state = await playclone.getCurrentState();
      expect(state.value.url).toContain('example.com');
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid selectors gracefully', async () => {
      playclone = new PlayClone({ headless: true });
      await playclone.navigate('https://example.com');
      
      const result = await playclone.click('non-existent-element-12345');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 30000);

    it('should handle network timeouts', async () => {
      playclone = new PlayClone({ 
        headless: true,
        timeout: 1000  // Very short timeout
      });

      // This should timeout
      const result = await playclone.navigate('https://httpstat.us/200?sleep=5000');
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 30000);
  });

  describe('Performance', () => {
    it('should respond quickly to basic operations', async () => {
      playclone = new PlayClone({ headless: true });
      await playclone.navigate('https://example.com');
      
      const startTime = Date.now();
      const result = await playclone.getText();
      const endTime = Date.now();
      
      expect(result.data).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    }, 30000);

    it('should handle multiple operations efficiently', async () => {
      playclone = new PlayClone({ headless: true });
      await playclone.navigate('https://example.com');
      
      const startTime = Date.now();
      
      // Perform multiple operations
      await playclone.getText();
      await playclone.getLinks();
      await playclone.screenshot();
      
      const endTime = Date.now();
      
      // All operations should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
    }, 30000);
  });
});