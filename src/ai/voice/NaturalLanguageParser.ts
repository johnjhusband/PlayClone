import { ActionResult } from '../../types';

export interface ParsedCommand {
  action: string;
  target?: string;
  value?: string;
  modifiers?: string[];
  confidence: number;
  alternatives?: ParsedCommand[];
}

export interface ContextualHint {
  previousAction?: string;
  currentPage?: string;
  availableElements?: string[];
  userPreferences?: Record<string, any>;
}

export class NaturalLanguageParser {
  private synonymMap: Map<string, string[]>;
  private contextStack: ParsedCommand[] = [];
  private pronounResolution: Map<string, string> = new Map();

  constructor() {
    this.synonymMap = this.initializeSynonyms();
  }

  private initializeSynonyms(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    
    // Action synonyms
    map.set('click', ['tap', 'press', 'select', 'choose', 'pick', 'hit']);
    map.set('navigate', ['go', 'open', 'visit', 'browse', 'load', 'access']);
    map.set('fill', ['type', 'enter', 'input', 'write', 'insert', 'put']);
    map.set('scroll', ['swipe', 'pan', 'move']);
    map.set('read', ['get', 'extract', 'show', 'display', 'tell']);
    map.set('search', ['find', 'look for', 'locate', 'query']);
    
    // Element synonyms
    map.set('button', ['btn', 'control', 'action']);
    map.set('link', ['hyperlink', 'url', 'anchor']);
    map.set('input', ['field', 'textbox', 'box', 'form field']);
    map.set('dropdown', ['select', 'combobox', 'menu', 'list']);
    
    return map;
  }

  parse(input: string, context?: ContextualHint): ParsedCommand {
    const normalized = this.normalizeInput(input);
    const tokens = this.tokenize(normalized);
    const command = this.identifyCommand(tokens, context);
    
    // Store in context stack for pronoun resolution
    this.contextStack.push(command);
    if (this.contextStack.length > 10) {
      this.contextStack.shift();
    }
    
    return command;
  }

  private normalizeInput(input: string): string {
    // Convert to lowercase and clean up
    let normalized = input.toLowerCase().trim();
    
    // Expand contractions
    normalized = normalized
      .replace(/don't/g, 'do not')
      .replace(/won't/g, 'will not')
      .replace(/can't/g, 'cannot')
      .replace(/n't/g, ' not')
      .replace(/'ll/g, ' will')
      .replace(/'ve/g, ' have')
      .replace(/'re/g, ' are')
      .replace(/'d/g, ' would')
      .replace(/'s/g, ' is');
    
    // Remove punctuation except quotes
    normalized = normalized.replace(/[.,!?;:]/g, '');
    
    return normalized;
  }

  private tokenize(input: string): string[] {
    // Preserve quoted strings as single tokens
    const quotedStrings: string[] = [];
    const processed = input.replace(/["']([^"']+)["']/g, (match, content) => {
      quotedStrings.push(content);
      return `__QUOTED_${quotedStrings.length - 1}__`;
    });
    
    // Split by whitespace
    let tokens = processed.split(/\s+/);
    
    // Restore quoted strings
    tokens = tokens.map(token => {
      const match = token.match(/__QUOTED_(\d+)__/);
      if (match) {
        return quotedStrings[parseInt(match[1])];
      }
      return token;
    });
    
    return tokens;
  }

  private identifyCommand(tokens: string[], context?: ContextualHint): ParsedCommand {
    const command: ParsedCommand = {
      action: 'unknown',
      confidence: 0
    };
    
    // Identify action
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const action = this.matchAction(token);
      
      if (action) {
        command.action = action;
        command.confidence = 0.8;
        
        // Extract target and value based on action
        this.extractParameters(tokens, i, command, context);
        break;
      }
    }
    
    // Handle pronouns
    this.resolvePronoun(command, context);
    
    // Generate alternatives
    command.alternatives = this.generateAlternatives(tokens, context);
    
    return command;
  }

  private matchAction(token: string): string | null {
    // Direct match
    for (const [action, synonyms] of this.synonymMap.entries()) {
      if (action === token || synonyms.includes(token)) {
        return action;
      }
    }
    
    // Common action patterns
    const actionPatterns: Record<string, RegExp> = {
      click: /^(click|tap|press)/,
      navigate: /^(go|nav|open|visit)/,
      fill: /^(type|fill|enter|input)/,
      scroll: /^(scroll|swipe)/,
      read: /^(read|get|extract)/,
      search: /^(search|find|look)/
    };
    
    for (const [action, pattern] of Object.entries(actionPatterns)) {
      if (pattern.test(token)) {
        return action;
      }
    }
    
    return null;
  }

  private extractParameters(
    tokens: string[], 
    actionIndex: number, 
    command: ParsedCommand,
    context?: ContextualHint
  ): void {
    const remainingTokens = tokens.slice(actionIndex + 1);
    
    switch (command.action) {
      case 'navigate':
        command.target = this.extractUrl(remainingTokens) || remainingTokens.join(' ');
        break;
        
      case 'click':
        command.target = this.extractElement(remainingTokens, context);
        break;
        
      case 'fill':
        const fillResult = this.extractFillParameters(remainingTokens);
        command.target = fillResult.field;
        command.value = fillResult.value;
        break;
        
      case 'scroll':
        command.modifiers = this.extractScrollModifiers(remainingTokens);
        break;
        
      case 'search':
        command.value = remainingTokens.join(' ').replace(/^for\s+/, '');
        break;
        
      default:
        command.target = remainingTokens.join(' ');
    }
  }

  private extractUrl(tokens: string[]): string | null {
    const urlTokens = tokens.join(' ');
    
    // Look for URL patterns
    const urlPattern = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b/;
    const match = urlTokens.match(urlPattern);
    
    return match ? match[0] : null;
  }

  private extractElement(tokens: string[], context?: ContextualHint): string {
    // Remove common articles and prepositions
    const filtered = tokens.filter(t => !['the', 'a', 'an', 'on', 'at', 'in'].includes(t));
    
    // Look for element type keywords
    const elementTypes = ['button', 'link', 'input', 'field', 'menu', 'tab', 'checkbox', 'radio'];
    const foundType = filtered.find(t => elementTypes.includes(t));
    
    if (foundType) {
      // Build element description around the type
      const typeIndex = filtered.indexOf(foundType);
      const description = filtered.slice(Math.max(0, typeIndex - 2), typeIndex + 1).join(' ');
      return description;
    }
    
    // Check context for available elements
    if (context?.availableElements) {
      const elementString = filtered.join(' ');
      for (const available of context.availableElements) {
        if (available.toLowerCase().includes(elementString)) {
          return available;
        }
      }
    }
    
    return filtered.join(' ');
  }

  private extractFillParameters(tokens: string[]): { field: string; value: string } {
    // Look for patterns like "X with Y" or "Y in X"
    const withIndex = tokens.indexOf('with');
    const inIndex = tokens.indexOf('in');
    const intoIndex = tokens.indexOf('into');
    
    if (withIndex > 0) {
      return {
        field: tokens.slice(0, withIndex).join(' '),
        value: tokens.slice(withIndex + 1).join(' ')
      };
    }
    
    if (inIndex > 0) {
      return {
        value: tokens.slice(0, inIndex).join(' '),
        field: tokens.slice(inIndex + 1).join(' ')
      };
    }
    
    if (intoIndex > 0) {
      return {
        value: tokens.slice(0, intoIndex).join(' '),
        field: tokens.slice(intoIndex + 1).join(' ')
      };
    }
    
    // Default: assume everything is the value
    return {
      field: 'input',
      value: tokens.join(' ')
    };
  }

  private extractScrollModifiers(tokens: string[]): string[] {
    const modifiers: string[] = [];
    
    // Direction
    const directions = ['up', 'down', 'left', 'right', 'top', 'bottom'];
    const direction = tokens.find(t => directions.includes(t));
    if (direction) modifiers.push(direction);
    
    // Amount
    const amountMatch = tokens.join(' ').match(/(\d+)\s*(px|pixels?|lines?|pages?)?/);
    if (amountMatch) {
      modifiers.push(amountMatch[0]);
    }
    
    return modifiers;
  }

  private resolvePronoun(command: ParsedCommand, context?: ContextualHint): void {
    if (!command.target) return;
    
    const pronouns = ['it', 'this', 'that', 'them', 'there'];
    if (pronouns.includes(command.target)) {
      // Try to resolve from context
      if (this.contextStack.length > 1) {
        const previousCommand = this.contextStack[this.contextStack.length - 2];
        if (previousCommand.target) {
          this.pronounResolution.set(command.target, previousCommand.target);
          command.target = previousCommand.target;
          command.confidence *= 0.9; // Slightly lower confidence for pronoun resolution
        }
      }
    }
  }

  private generateAlternatives(tokens: string[], context?: ContextualHint): ParsedCommand[] {
    const alternatives: ParsedCommand[] = [];
    
    // Try different action interpretations
    const possibleActions = ['click', 'navigate', 'fill', 'search'];
    for (const action of possibleActions) {
      if (this.couldBeAction(tokens, action)) {
        const alt = this.createAlternativeCommand(tokens, action, context);
        if (alt.confidence > 0.3) {
          alternatives.push(alt);
        }
      }
    }
    
    // Sort by confidence
    alternatives.sort((a, b) => b.confidence - a.confidence);
    
    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  private couldBeAction(tokens: string[], action: string): boolean {
    // Simple heuristics for determining if tokens could represent an action
    switch (action) {
      case 'navigate':
        return tokens.some(t => t.includes('.') || t === 'page' || t === 'site');
      case 'click':
        return tokens.some(t => ['button', 'link', 'tab', 'menu'].includes(t));
      case 'fill':
        return tokens.some(t => ['field', 'input', 'form', 'box'].includes(t));
      case 'search':
        return tokens.length > 1 && !tokens.some(t => t.startsWith('http'));
      default:
        return false;
    }
  }

  private createAlternativeCommand(
    tokens: string[], 
    action: string, 
    context?: ContextualHint
  ): ParsedCommand {
    const command: ParsedCommand = {
      action,
      confidence: 0.5
    };
    
    // Simplified parameter extraction for alternatives
    const tokenString = tokens.join(' ');
    
    switch (action) {
      case 'navigate':
        command.target = tokenString;
        if (tokenString.includes('.')) command.confidence = 0.7;
        break;
      case 'click':
        command.target = tokenString;
        if (tokens.some(t => ['button', 'link'].includes(t))) command.confidence = 0.6;
        break;
      case 'fill':
        command.value = tokenString;
        command.confidence = 0.4;
        break;
      case 'search':
        command.value = tokenString;
        command.confidence = 0.6;
        break;
    }
    
    return command;
  }

  // Batch processing for multiple commands
  parseMultiple(inputs: string[], context?: ContextualHint): ParsedCommand[] {
    const commands: ParsedCommand[] = [];
    let currentContext = context;
    
    for (const input of inputs) {
      const command = this.parse(input, currentContext);
      commands.push(command);
      
      // Update context for next command
      currentContext = {
        ...currentContext,
        previousAction: command.action
      };
    }
    
    return commands;
  }

  // Confidence scoring based on context
  adjustConfidence(command: ParsedCommand, context?: ContextualHint): number {
    let confidence = command.confidence;
    
    // Boost confidence if action matches previous pattern
    if (context?.previousAction === command.action) {
      confidence *= 1.1;
    }
    
    // Boost if target element is in available elements
    if (command.target && context?.availableElements) {
      const isAvailable = context.availableElements.some(el => 
        el.toLowerCase().includes(command.target!.toLowerCase())
      );
      if (isAvailable) confidence *= 1.2;
    }
    
    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  // Get command suggestions based on context
  getSuggestions(partialInput: string, context?: ContextualHint): string[] {
    const suggestions: string[] = [];
    const normalized = this.normalizeInput(partialInput);
    
    // Suggest actions
    if (normalized.length < 5) {
      suggestions.push('click the button', 'go to website', 'fill the form', 'search for');
    }
    
    // Context-based suggestions
    if (context?.availableElements && normalized.includes('click')) {
      for (const element of context.availableElements.slice(0, 3)) {
        suggestions.push(`click ${element}`);
      }
    }
    
    if (context?.previousAction === 'navigate') {
      suggestions.push('click the login button', 'fill the search box', 'go back');
    }
    
    return suggestions;
  }
}