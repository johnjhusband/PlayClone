/**
 * ElementNormalizer - Normalizes natural language element descriptions
 * Converts various forms of element descriptions into consistent patterns
 */

export class ElementNormalizer {
  /**
   * Common synonyms for UI elements
   */
  private readonly synonyms: Record<string, string[]> = {
    button: ['btn', 'button', 'submit', 'click', 'press'],
    link: ['link', 'anchor', 'hyperlink', 'url'],
    input: ['input', 'field', 'textbox', 'text field', 'form field', 'entry'],
    checkbox: ['checkbox', 'check box', 'check', 'tickbox', 'tick'],
    radio: ['radio', 'radio button', 'option', 'choice'],
    dropdown: ['dropdown', 'select', 'combo box', 'combobox', 'list', 'menu'],
    search: ['search', 'search box', 'search field', 'query', 'find'],
    email: ['email', 'e-mail', 'mail', 'email address'],
    password: ['password', 'pass', 'pwd', 'secret'],
    username: ['username', 'user name', 'user', 'login', 'account'],
    submit: ['submit', 'send', 'go', 'continue', 'next', 'proceed'],
    cancel: ['cancel', 'close', 'dismiss', 'back', 'return'],
    save: ['save', 'store', 'keep', 'apply', 'update'],
    delete: ['delete', 'remove', 'trash', 'discard', 'clear'],
    edit: ['edit', 'modify', 'change', 'update'],
    create: ['create', 'new', 'add', 'make', 'generate'],
    login: ['login', 'log in', 'sign in', 'signin', 'authenticate'],
    logout: ['logout', 'log out', 'sign out', 'signout', 'exit'],
    register: ['register', 'sign up', 'signup', 'join', 'create account'],
    upload: ['upload', 'attach', 'browse', 'choose file', 'select file'],
    download: ['download', 'save', 'export', 'get'],
  };

  /**
   * Common UI action patterns
   */
  private readonly actionPatterns: RegExp[] = [
    /^(click|press|tap|hit|push)\s+(on\s+)?(the\s+)?/i,
    /^(type|enter|input|fill)\s+(in|into)?\s*(the\s+)?/i,
    /^(select|choose|pick)\s+(from\s+)?(the\s+)?/i,
    /^(check|tick|mark)\s+(the\s+)?/i,
    /^(uncheck|untick|unmark)\s+(the\s+)?/i,
    /^(hover\s+over|mouse\s+over)\s+(the\s+)?/i,
    /^(scroll\s+to|go\s+to|navigate\s+to)\s+(the\s+)?/i,
    /^(find|locate|look\s+for)\s+(the\s+)?/i,
  ];

  /**
   * Position modifiers
   */
  private readonly positionModifiers: Record<string, string> = {
    'first': ':first',
    'last': ':last',
    'second': ':nth(1)',
    'third': ':nth(2)',
    'top': ':first',
    'bottom': ':last',
    'left': '[position="left"]',
    'right': '[position="right"]',
    'middle': '[position="center"]',
    'center': '[position="center"]',
  };

  /**
   * Color mappings for elements
   */
  private readonly colorMappings: Record<string, string[]> = {
    red: ['danger', 'error', 'alert', 'warning'],
    green: ['success', 'confirm', 'accept', 'go'],
    blue: ['primary', 'info', 'default'],
    yellow: ['warning', 'caution'],
    orange: ['warning', 'alert'],
    gray: ['disabled', 'inactive', 'secondary'],
    grey: ['disabled', 'inactive', 'secondary'],
  };

  /**
   * Normalize natural language description to consistent format
   */
  normalize(description: string): {
    original: string;
    normalized: string;
    elementType?: string;
    action?: string;
    modifiers: string[];
    attributes: Record<string, string>;
  } {
    const original = description;
    let normalized = description.toLowerCase().trim();
    let elementType: string | undefined;
    let action: string | undefined;
    const modifiers: string[] = [];
    const attributes: Record<string, string> = {};

    // Remove action patterns and extract action
    for (const pattern of this.actionPatterns) {
      const match = normalized.match(pattern);
      if (match) {
        action = this.extractAction(match[0]);
        normalized = normalized.replace(pattern, '').trim();
        break;
      }
    }

    // Remove common articles and prepositions
    normalized = this.removeCommonWords(normalized);

    // Extract position modifiers
    const positionResult = this.extractPositionModifiers(normalized);
    normalized = positionResult.text;
    modifiers.push(...positionResult.modifiers);

    // Extract color attributes
    const colorResult = this.extractColorAttributes(normalized);
    normalized = colorResult.text;
    Object.assign(attributes, colorResult.attributes);

    // Extract quotes text
    const quotedResult = this.extractQuotedText(normalized);
    normalized = quotedResult.text;
    if (quotedResult.quoted) {
      attributes.text = quotedResult.quoted;
    }

    // Identify element type from synonyms
    elementType = this.identifyElementType(normalized);

    // Extract attributes from parentheses
    const parenResult = this.extractParenthesesContent(normalized);
    normalized = parenResult.text;
    Object.assign(attributes, parenResult.attributes);

    // Clean up the normalized text
    normalized = this.cleanupText(normalized);

    return {
      original,
      normalized,
      elementType,
      action,
      modifiers,
      attributes,
    };
  }

  /**
   * Remove common words that don't contribute to element identification
   */
  private removeCommonWords(text: string): string {
    const commonWords = [
      'the', 'a', 'an', 'on', 'in', 'at', 'to', 'for',
      'with', 'by', 'from', 'up', 'down', 'out', 'off',
      'that', 'this', 'these', 'those', 'which',
    ];
    
    const words = text.split(/\s+/);
    const filtered = words.filter(word => !commonWords.includes(word));
    return filtered.join(' ');
  }

  /**
   * Extract action from matched pattern
   */
  private extractAction(match: string): string {
    const actionMap: Record<string, string> = {
      'click': 'click',
      'press': 'click',
      'tap': 'click',
      'hit': 'click',
      'push': 'click',
      'type': 'type',
      'enter': 'type',
      'input': 'type',
      'fill': 'fill',
      'select': 'select',
      'choose': 'select',
      'pick': 'select',
      'check': 'check',
      'tick': 'check',
      'mark': 'check',
      'uncheck': 'uncheck',
      'untick': 'uncheck',
      'unmark': 'uncheck',
      'hover': 'hover',
      'mouse over': 'hover',
      'scroll': 'scroll',
      'navigate': 'navigate',
      'find': 'find',
      'locate': 'find',
    };

    const firstWord = match.split(/\s+/)[0].toLowerCase();
    return actionMap[firstWord] || 'click';
  }

  /**
   * Extract position modifiers from text
   */
  private extractPositionModifiers(text: string): {
    text: string;
    modifiers: string[];
  } {
    const modifiers: string[] = [];
    let modifiedText = text;

    for (const [key, value] of Object.entries(this.positionModifiers)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      if (regex.test(modifiedText)) {
        modifiers.push(value);
        modifiedText = modifiedText.replace(regex, '').trim();
      }
    }

    return { text: modifiedText, modifiers };
  }

  /**
   * Extract color attributes from text
   */
  private extractColorAttributes(text: string): {
    text: string;
    attributes: Record<string, string>;
  } {
    const attributes: Record<string, string> = {};
    let modifiedText = text;

    for (const [color, meanings] of Object.entries(this.colorMappings)) {
      const regex = new RegExp(`\\b${color}\\b`, 'gi');
      if (regex.test(modifiedText)) {
        attributes.class = meanings[0];
        attributes.color = color;
        modifiedText = modifiedText.replace(regex, '').trim();
      }
    }

    return { text: modifiedText, attributes };
  }

  /**
   * Extract quoted text
   */
  private extractQuotedText(text: string): {
    text: string;
    quoted?: string;
  } {
    const match = text.match(/["']([^"']+)["']/);
    if (match) {
      return {
        text: text.replace(match[0], '').trim(),
        quoted: match[1],
      };
    }
    return { text };
  }

  /**
   * Extract content from parentheses
   */
  private extractParenthesesContent(text: string): {
    text: string;
    attributes: Record<string, string>;
  } {
    const attributes: Record<string, string> = {};
    const match = text.match(/\(([^)]+)\)/);
    
    if (match) {
      const content = match[1];
      // Parse as key=value pairs
      const pairs = content.split(/[,;]/);
      for (const pair of pairs) {
        const [key, value] = pair.split('=').map(s => s.trim());
        if (key && value) {
          attributes[key] = value.replace(/["']/g, '');
        } else if (key) {
          attributes.label = key;
        }
      }
      
      return {
        text: text.replace(match[0], '').trim(),
        attributes,
      };
    }
    
    return { text, attributes };
  }

  /**
   * Identify element type from text
   */
  private identifyElementType(text: string): string | undefined {
    for (const [type, synonymList] of Object.entries(this.synonyms)) {
      for (const synonym of synonymList) {
        if (text.includes(synonym)) {
          return type;
        }
      }
    }
    return undefined;
  }

  /**
   * Clean up normalized text
   */
  private cleanupText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '')
      .trim();
  }

  /**
   * Convert normalized description to selector hints
   */
  toSelectorHints(normalized: ReturnType<typeof this.normalize>): {
    text?: string;
    role?: string;
    label?: string;
    placeholder?: string;
    class?: string;
    modifiers?: string[];
  } {
    const hints: any = {};

    // Set element role based on type
    if (normalized.elementType) {
      hints.role = normalized.elementType;
    }

    // Set text if available
    if (normalized.attributes.text) {
      hints.text = normalized.attributes.text;
    } else if (normalized.normalized) {
      hints.text = normalized.normalized;
    }

    // Set other attributes
    if (normalized.attributes.label) {
      hints.label = normalized.attributes.label;
    }
    if (normalized.attributes.placeholder) {
      hints.placeholder = normalized.attributes.placeholder;
    }
    if (normalized.attributes.class) {
      hints.class = normalized.attributes.class;
    }

    // Add modifiers
    if (normalized.modifiers.length > 0) {
      hints.modifiers = normalized.modifiers;
    }

    return hints;
  }
}