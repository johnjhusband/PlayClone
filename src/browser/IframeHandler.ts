import { Frame, Page } from 'playwright-core';
import { AIResponse, IframeInfo } from '../types';

export class IframeHandler {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private createResponse(data: any): AIResponse {
    return {
      result: data,
      size: data ? JSON.stringify(data).length : 0
    };
  }

  async listIframes(): Promise<AIResponse> {
    try {
      const frames = this.page.frames();
      const iframeInfo: IframeInfo[] = [];

      for (const frame of frames) {
        if (frame === this.page.mainFrame()) continue;

        const url = frame.url();
        const name = frame.name();
        const parentFrame = frame.parentFrame();
        
        let selector = '';
        if (parentFrame) {
          const frameElement = await frame.frameElement();
          if (frameElement) {
            selector = await frameElement.evaluate((el: HTMLElement) => {
              const tag = el.tagName.toLowerCase();
              const id = el.id ? `#${el.id}` : '';
              const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
              return `${tag}${id}${classes}`;
            });
          }
        }

        iframeInfo.push({
          url,
          name: name || undefined,
          selector: selector || undefined,
          isDetached: frame.isDetached(),
          level: this.getFrameLevel(frame)
        });
      }

      return this.createResponse({
        iframes: iframeInfo,
        count: iframeInfo.length
      });
    } catch (error) {
      return this.createResponse(null);
    }
  }

  async switchToIframe(selector: string): Promise<AIResponse> {
    try {
      const frameElement = await this.page.$(selector);
      if (!frameElement) {
        return this.createResponse(null);
      }

      const frame = await frameElement.contentFrame();
      if (!frame) {
        return this.createResponse(null);
      }

      // Store frame reference for subsequent operations
      (this.page as any).__activeFrame = frame;

      return this.createResponse({
        switched: true,
        url: frame.url(),
        name: frame.name()
      });
    } catch (error) {
      return this.createResponse(null);
    }
  }

  async switchToMainFrame(): Promise<AIResponse> {
    try {
      // Clear active frame reference
      delete (this.page as any).__activeFrame;

      return this.createResponse({
        switched: true,
        url: this.page.mainFrame().url()
      });
    } catch (error) {
      return this.createResponse(null);
    }
  }

  async executeInIframe(selector: string, action: string, ...args: any[]): Promise<AIResponse> {
    try {
      const frameElement = await this.page.$(selector);
      if (!frameElement) {
        return this.createResponse(null);
      }

      const frame = await frameElement.contentFrame();
      if (!frame) {
        return this.createResponse(null);
      }

      let result: any;
      switch (action) {
        case 'click':
          await frame.click(args[0]);
          result = { clicked: true };
          break;
        case 'fill':
          await frame.fill(args[0], args[1]);
          result = { filled: true };
          break;
        case 'getText':
          const element = await frame.$(args[0] || 'body');
          if (element) {
            result = { text: await element.textContent() };
          } else {
            result = { text: await frame.textContent('body') };
          }
          break;
        case 'evaluate':
          result = await frame.evaluate(args[0]);
          break;
        default:
          return this.createResponse(null);
      }

      return this.createResponse(result);
    } catch (error) {
      return this.createResponse(null);
    }
  }

  async waitForIframe(selector: string, timeout: number = 30000): Promise<AIResponse> {
    try {
      await this.page.waitForSelector(selector, { timeout });
      
      const frameElement = await this.page.$(selector);
      if (!frameElement) {
        return this.createResponse(null);
      }

      const frame = await frameElement.contentFrame();
      if (!frame) {
        return this.createResponse(null);
      }

      await frame.waitForLoadState('domcontentloaded');

      return this.createResponse({
        ready: true,
        url: frame.url(),
        name: frame.name()
      });
    } catch (error) {
      return this.createResponse(null);
    }
  }

  async navigateInIframe(selector: string, url: string): Promise<AIResponse> {
    try {
      const frameElement = await this.page.$(selector);
      if (!frameElement) {
        return this.createResponse(null);
      }

      const frame = await frameElement.contentFrame();
      if (!frame) {
        return this.createResponse(null);
      }

      await frame.goto(url);
      await frame.waitForLoadState('domcontentloaded');

      return this.createResponse({
        navigated: true,
        url: frame.url()
      });
    } catch (error) {
      return this.createResponse(null);
    }
  }

  private getFrameLevel(frame: Frame): number {
    let level = 0;
    let current = frame.parentFrame();
    while (current && current !== this.page.mainFrame()) {
      level++;
      current = current.parentFrame();
    }
    return level;
  }

  getActiveFrame(): Frame {
    return (this.page as any).__activeFrame || this.page.mainFrame();
  }

  async findIframeByUrl(urlPattern: string | RegExp): Promise<Frame | null> {
    const frames = this.page.frames();
    const pattern = typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern;
    
    for (const frame of frames) {
      if (pattern.test(frame.url())) {
        return frame;
      }
    }
    
    return null;
  }

  async findIframeByName(name: string): Promise<Frame | null> {
    const frames = this.page.frames();
    
    for (const frame of frames) {
      if (frame.name() === name) {
        return frame;
      }
    }
    
    return null;
  }
}