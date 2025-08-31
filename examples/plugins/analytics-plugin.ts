import { BasePlugin } from '../../src/plugins/BasePlugin';
import { PluginMetadata, PluginContext } from '../../src/plugins/PluginManager';

/**
 * Analytics Plugin for PlayClone
 * Tracks browser automation events and provides analytics
 */
export class AnalyticsPlugin extends BasePlugin {
  metadata: PluginMetadata = {
    name: 'analytics-plugin',
    version: '1.0.0',
    description: 'Tracks and analyzes browser automation events',
    author: 'PlayClone Team',
    keywords: ['analytics', 'tracking', 'metrics'],
    license: 'MIT'
  };

  private events: Array<{
    timestamp: number;
    type: string;
    data: any;
  }> = [];

  private sessionStartTime: number = 0;
  private navigationCount: number = 0;
  private clickCount: number = 0;
  private fillCount: number = 0;
  private extractCount: number = 0;
  private errorCount: number = 0;

  async onLoad(context: PluginContext): Promise<void> {
    await super.onLoad(context);
    this.sessionStartTime = Date.now();
    
    // Register commands
    this.registerCommand('getAnalytics', this.getAnalytics.bind(this));
    this.registerCommand('clearAnalytics', this.clearAnalytics.bind(this));
    this.registerCommand('exportAnalytics', this.exportAnalytics.bind(this));
    
    // Register hooks
    this.registerHook('analytics:update', this.handleAnalyticsUpdate.bind(this));
    
    context.logger.info('Analytics tracking started');
  }

  async onUnload(context: PluginContext): Promise<void> {
    // Save analytics before unloading
    await this.saveAnalytics(context);
    await super.onUnload(context);
  }

  async onBeforeNavigate(url: string, context: PluginContext): Promise<void> {
    this.trackEvent('navigation:start', { url });
  }

  async onAfterNavigate(url: string, context: PluginContext): Promise<void> {
    this.navigationCount++;
    this.trackEvent('navigation:complete', { url });
    
    // Get page metrics if available
    if (context.page) {
      try {
        const metrics = await context.page.evaluate(() => {
          const perf = window.performance;
          if (perf && perf.timing) {
            const timing = perf.timing;
            return {
              domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
              pageLoad: timing.loadEventEnd - timing.navigationStart,
              responseTime: timing.responseEnd - timing.requestStart
            };
          }
          return null;
        });
        
        if (metrics) {
          this.trackEvent('performance:metrics', metrics);
        }
      } catch (error) {
        // Ignore errors in metric collection
      }
    }
  }

  async onBeforeClick(selector: string, context: PluginContext): Promise<void> {
    this.trackEvent('click:start', { selector });
  }

  async onAfterClick(selector: string, context: PluginContext): Promise<void> {
    this.clickCount++;
    this.trackEvent('click:complete', { selector });
  }

  async onBeforeFill(selector: string, value: string, context: PluginContext): Promise<void> {
    this.trackEvent('fill:start', { 
      selector, 
      valueLength: value.length 
    });
  }

  async onAfterFill(selector: string, value: string, context: PluginContext): Promise<void> {
    this.fillCount++;
    this.trackEvent('fill:complete', { 
      selector, 
      valueLength: value.length 
    });
  }

  async onBeforeExtract(type: string, context: PluginContext): Promise<void> {
    this.trackEvent('extract:start', { type });
  }

  async onAfterExtract(type: string, data: any, context: PluginContext): Promise<any> {
    this.extractCount++;
    
    // Track extraction metrics
    let dataSize = 0;
    if (data) {
      try {
        dataSize = JSON.stringify(data).length;
      } catch {
        dataSize = -1;
      }
    }
    
    this.trackEvent('extract:complete', { 
      type, 
      dataSize,
      hasData: data !== null 
    });
    
    return data;
  }

  async onError(error: Error, context: PluginContext): Promise<void> {
    this.errorCount++;
    this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    await super.onError(error, context);
  }

  private trackEvent(type: string, data: any): void {
    this.events.push({
      timestamp: Date.now(),
      type,
      data
    });
    
    // Keep only last 1000 events to prevent memory issues
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  private async getAnalytics(args: any, context: PluginContext): Promise<any> {
    const sessionDuration = Date.now() - this.sessionStartTime;
    
    return {
      session: {
        startTime: this.sessionStartTime,
        duration: sessionDuration,
        durationFormatted: this.formatDuration(sessionDuration)
      },
      counts: {
        navigations: this.navigationCount,
        clicks: this.clickCount,
        fills: this.fillCount,
        extractions: this.extractCount,
        errors: this.errorCount,
        totalEvents: this.events.length
      },
      rates: {
        navigationsPerMinute: (this.navigationCount / (sessionDuration / 60000)).toFixed(2),
        clicksPerMinute: (this.clickCount / (sessionDuration / 60000)).toFixed(2),
        errorRate: this.navigationCount > 0 
          ? ((this.errorCount / this.navigationCount) * 100).toFixed(2) + '%'
          : '0%'
      },
      recentEvents: this.events.slice(-10),
      topEventTypes: this.getTopEventTypes()
    };
  }

  private async clearAnalytics(args: any, context: PluginContext): Promise<any> {
    this.events = [];
    this.navigationCount = 0;
    this.clickCount = 0;
    this.fillCount = 0;
    this.extractCount = 0;
    this.errorCount = 0;
    this.sessionStartTime = Date.now();
    
    context.logger.info('Analytics cleared');
    return { success: true, message: 'Analytics data cleared' };
  }

  private async exportAnalytics(args: any, context: PluginContext): Promise<any> {
    const analytics = await this.getAnalytics(args, context);
    const exportData = {
      ...analytics,
      events: this.events,
      exported: new Date().toISOString()
    };
    
    // Save to storage
    await context.storage.set('analytics-export', exportData);
    
    return {
      success: true,
      message: 'Analytics exported to storage',
      summary: analytics
    };
  }

  private async handleAnalyticsUpdate(data: any, context: PluginContext): Promise<any> {
    // Custom analytics update handler
    if (data.type && data.payload) {
      this.trackEvent(data.type, data.payload);
    }
    return { success: true };
  }

  private async saveAnalytics(context: PluginContext): Promise<void> {
    try {
      const analytics = await this.getAnalytics({}, context);
      await context.storage.set('last-session', analytics);
      context.logger.info('Analytics saved to storage');
    } catch (error) {
      context.logger.error('Failed to save analytics', error);
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private getTopEventTypes(): Array<{ type: string; count: number }> {
    const typeCounts: Record<string, number> = {};
    
    for (const event of this.events) {
      typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
    }
    
    return Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}

// Export default for dynamic import
export default AnalyticsPlugin;