import {
  PlayClonePlugin,
  PluginMetadata,
  PluginContext,
  CommandHandler,
  HookHandler,
  SelectorHandler,
  ExtractorHandler
} from './PluginManager';

export abstract class BasePlugin implements PlayClonePlugin {
  abstract metadata: PluginMetadata;
  
  commands?: Record<string, CommandHandler> = {};
  hooks?: Record<string, HookHandler> = {};
  selectors?: Record<string, SelectorHandler> = {};
  extractors?: Record<string, ExtractorHandler> = {};
  
  protected context?: PluginContext;
  
  async onLoad(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.info(`Plugin ${this.metadata.name} loaded`);
  }
  
  async onUnload(context: PluginContext): Promise<void> {
    context.logger.info(`Plugin ${this.metadata.name} unloaded`);
    this.context = undefined;
  }
  
  async onBeforeNavigate(_url: string, _context: PluginContext): Promise<void> {
    // Override in subclass if needed
  }
  
  async onAfterNavigate(_url: string, _context: PluginContext): Promise<void> {
    // Override in subclass if needed
  }
  
  async onBeforeClick(_selector: string, _context: PluginContext): Promise<void> {
    // Override in subclass if needed
  }
  
  async onAfterClick(_selector: string, _context: PluginContext): Promise<void> {
    // Override in subclass if needed
  }
  
  async onBeforeFill(_selector: string, _value: string, _context: PluginContext): Promise<void> {
    // Override in subclass if needed
  }
  
  async onAfterFill(_selector: string, _value: string, _context: PluginContext): Promise<void> {
    // Override in subclass if needed
  }
  
  async onBeforeExtract(_type: string, _context: PluginContext): Promise<void> {
    // Override in subclass if needed
  }
  
  async onAfterExtract(_type: string, data: any, _context: PluginContext): Promise<any> {
    // Override in subclass if needed
    return data;
  }
  
  async onError(error: Error, context: PluginContext): Promise<void> {
    context.logger.error(`Error in plugin ${this.metadata.name}:`, error);
  }
  
  protected registerCommand(name: string, handler: CommandHandler): void {
    if (!this.commands) this.commands = {};
    this.commands[name] = handler;
  }
  
  protected registerHook(event: string, handler: HookHandler): void {
    if (!this.hooks) this.hooks = {};
    this.hooks[event] = handler;
  }
  
  protected registerSelector(name: string, handler: SelectorHandler): void {
    if (!this.selectors) this.selectors = {};
    this.selectors[name] = handler;
  }
  
  protected registerExtractor(name: string, handler: ExtractorHandler): void {
    if (!this.extractors) this.extractors = {};
    this.extractors[name] = handler;
  }
}