import { Page } from 'playwright';

export class CanvasActions {
  constructor(private page: Page) {}

  /**
   * Click at specific coordinates on the page
   */
  async clickAt(x: number, y: number): Promise<void> {
    await this.page.mouse.click(x, y);
  }

  /**
   * Type text using keyboard events
   */
  async typeText(text: string): Promise<void> {
    await this.page.keyboard.type(text);
  }

  /**
   * Press a key
   */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * Move mouse to coordinates
   */
  async moveTo(x: number, y: number): Promise<void> {
    await this.page.mouse.move(x, y);
  }

  /**
   * Mouse down at coordinates
   */
  async mouseDown(x?: number, y?: number): Promise<void> {
    if (x !== undefined && y !== undefined) {
      await this.page.mouse.move(x, y);
    }
    await this.page.mouse.down();
  }

  /**
   * Mouse up at coordinates
   */
  async mouseUp(x?: number, y?: number): Promise<void> {
    if (x !== undefined && y !== undefined) {
      await this.page.mouse.move(x, y);
    }
    await this.page.mouse.up();
  }

  /**
   * Drag from one point to another
   */
  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    await this.page.mouse.move(fromX, fromY);
    await this.page.mouse.down();
    await this.page.mouse.move(toX, toY);
    await this.page.mouse.up();
  }
}