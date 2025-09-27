import { PlayClone } from '../../index';
import { ActionResult } from '../../types';

interface VoiceCommand {
  transcript: string;
  confidence: number;
  alternatives?: string[];
  language?: string;
}

interface VoiceResponse {
  text: string;
  speak: boolean;
  emotion?: 'neutral' | 'success' | 'error' | 'thinking';
}

interface CommandPattern {
  patterns: RegExp[];
  action: (matches: RegExpMatchArray | null, pc: PlayClone) => Promise<ActionResult>;
  response: (result: ActionResult) => VoiceResponse;
}

export class VoiceCommandHandler {
  private playclone: PlayClone;
  private commandPatterns: CommandPattern[];
  private isListening: boolean = false;
  private voiceSettings = {
    language: 'en-US',
    continuous: true,
    interimResults: true,
    maxAlternatives: 3,
    speakResponses: true,
    voiceRate: 1.0,
    voicePitch: 1.0
  };

  constructor(playclone: PlayClone) {
    this.playclone = playclone;
    this.commandPatterns = this.initializeCommandPatterns();
  }

  private initializeCommandPatterns(): CommandPattern[] {
    return [
      // Navigation commands
      {
        patterns: [
          /^(navigate|go|open|visit)\s+(?:to\s+)?(.+)$/i,
          /^open\s+(.+)\s+(?:website|site|page)$/i
        ],
        action: async (matches, pc) => {
          const url = matches?.[2] || matches?.[1] || '';
          const formattedUrl = this.formatUrl(url);
          return await pc.navigate(formattedUrl);
        },
        response: (result) => ({
          text: result.success ? `Navigated successfully` : `Failed to navigate: ${result.error}`,
          speak: true,
          emotion: result.success ? 'success' : 'error'
        })
      },

      // Click commands
      {
        patterns: [
          /^(?:click|tap|press)\s+(?:on\s+)?(?:the\s+)?(.+)$/i,
          /^select\s+(?:the\s+)?(.+)$/i
        ],
        action: async (matches, pc) => {
          const element = matches?.[1] || '';
          return await pc.click(element);
        },
        response: (result) => ({
          text: result.success ? 'Clicked successfully' : `Could not click: ${result.error}`,
          speak: true,
          emotion: result.success ? 'success' : 'error'
        })
      },

      // Form filling commands
      {
        patterns: [
          /^(?:type|enter|fill|input)\s+["'](.+?)["']\s+(?:in|into)\s+(?:the\s+)?(.+)$/i,
          /^(?:fill|enter)\s+(?:the\s+)?(.+?)\s+with\s+["'](.+?)["']$/i
        ],
        action: async (matches, pc) => {
          const value = matches?.[1] || matches?.[2] || '';
          const field = matches?.[2] || matches?.[1] || '';
          return await pc.fill(field, value);
        },
        response: (result) => ({
          text: result.success ? 'Filled the field' : `Could not fill field: ${result.error}`,
          speak: true,
          emotion: result.success ? 'success' : 'error'
        })
      },

      // Scroll commands
      {
        patterns: [
          /^scroll\s+(up|down|left|right)(?:\s+(\d+)\s*(?:pixels?)?)?$/i,
          /^scroll\s+to\s+(?:the\s+)?(top|bottom|end)$/i
        ],
        action: async (matches, pc) => {
          const direction = matches?.[1]?.toLowerCase() || 'down';
          const amount = parseInt(matches?.[2] || '300');
          
          // Use page.evaluate to scroll
          if (!pc.page) {
            return {
              success: false,
              action: 'scroll',
              error: 'No page loaded',
              timestamp: Date.now()
            };
          }
          
          try {
            if (direction === 'top') {
              await pc.page.evaluate(() => window.scrollTo(0, 0));
            } else if (direction === 'bottom' || direction === 'end') {
              await pc.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            } else {
              const x = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
              const y = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
              await pc.page.evaluate(({ x, y }) => window.scrollBy(x, y), { x, y });
            }
            
            return {
              success: true,
              action: 'scroll',
              timestamp: Date.now()
            };
          } catch (error) {
            return {
              success: false,
              action: 'scroll',
              error: error instanceof Error ? error.message : 'Scroll failed',
              timestamp: Date.now()
            };
          }
        },
        response: (result) => ({
          text: result.success ? 'Scrolled' : 'Could not scroll',
          speak: true,
          emotion: result.success ? 'success' : 'error'
        })
      },

      // Navigation control commands
      {
        patterns: [
          /^go\s+(back|forward)$/i,
          /^(?:refresh|reload)(?:\s+the\s+page)?$/i
        ],
        action: async (matches, pc) => {
          const command = matches?.[1]?.toLowerCase() || matches?.[0]?.toLowerCase();
          if (command?.includes('back')) {
            return await pc.back();
          } else if (command?.includes('forward')) {
            return await pc.forward();
          } else {
            return await pc.reload();
          }
        },
        response: (result) => ({
          text: result.success ? 'Done' : 'Navigation failed',
          speak: true,
          emotion: result.success ? 'success' : 'error'
        })
      },

      // Screenshot commands
      {
        patterns: [
          /^(?:take\s+a?\s+)?screenshot$/i,
          /^capture\s+(?:the\s+)?(?:screen|page)$/i
        ],
        action: async (matches, pc) => {
          const result = await pc.screenshot();
          // Convert ExtractedData to ActionResult
          return {
            success: result.data !== null,
            action: 'screenshot',
            data: result.data,
            timestamp: Date.now()
          };
        },
        response: (result) => ({
          text: result.success ? 'Screenshot captured' : 'Failed to capture screenshot',
          speak: true,
          emotion: result.success ? 'success' : 'error'
        })
      },

      // Text extraction commands
      {
        patterns: [
          /^(?:read|get|extract)\s+(?:the\s+)?(?:text|content)(?:\s+from\s+(.+))?$/i,
          /^what\s+does\s+(?:it|this|the\s+page)\s+say$/i
        ],
        action: async (matches, pc) => {
          const selector = matches?.[1];
          const result = selector ? await pc.getText(selector) : await pc.getText();
          // Convert ExtractedData to ActionResult
          return {
            success: result.data !== null,
            action: 'getText',
            data: result.data || '',
            timestamp: Date.now()
          };
        },
        response: (result) => {
          const text = (result as any).data || '';
          return {
            text: result.success ? `Text: ${text.substring(0, 100)}...` : 'Could not extract text',
            speak: true,
            emotion: result.success ? 'success' : 'error'
          };
        }
      },

      // Search commands
      {
        patterns: [
          /^search\s+(?:for\s+)?["']?(.+?)["']?$/i,
          /^find\s+["']?(.+?)["']?$/i
        ],
        action: async (matches, pc) => {
          const query = matches?.[1] || '';
          // Try to find a search box and fill it
          const searchResult = await pc.fill('search box, search input, search field', query);
          if (searchResult.success) {
            // Press Enter to submit
            if (pc.page) {
              await pc.page.keyboard.press('Enter');
            }
          }
          return searchResult;
        },
        response: (result) => ({
          text: result.success ? 'Searching...' : 'Could not find search box',
          speak: true,
          emotion: result.success ? 'thinking' : 'error'
        })
      },

      // Help command
      {
        patterns: [
          /^(?:help|what\s+can\s+you\s+do|commands?)$/i
        ],
        action: async () => {
          return {
            success: true,
            action: 'help',
            data: 'Available commands: navigate, click, fill, scroll, search, screenshot, read text, go back/forward, refresh',
            timestamp: Date.now()
          };
        },
        response: (result) => ({
          text: (result as any).data || 'Voice commands are ready',
          speak: true,
          emotion: 'neutral'
        })
      }
    ];
  }

  private formatUrl(input: string): string {
    // Clean up the input
    input = input.trim().toLowerCase();
    
    // Remove common speech artifacts
    input = input
      .replace(/\s+dot\s+/g, '.')
      .replace(/\s+slash\s+/g, '/')
      .replace(/\s+at\s+/g, '@')
      .replace(/\s+colon\s+/g, ':')
      .replace(/\s+/g, '');

    // Add protocol if missing
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
      // Check if it looks like a domain
      if (input.includes('.') || input === 'localhost') {
        input = 'https://' + input;
      } else {
        // Assume it's a search query
        input = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
      }
    }

    return input;
  }

  async processVoiceCommand(command: VoiceCommand): Promise<VoiceResponse> {
    const transcript = command.transcript.trim();
    
    if (!transcript) {
      return {
        text: 'I didn\'t catch that. Please try again.',
        speak: true,
        emotion: 'neutral'
      };
    }

    // Try each command pattern
    for (const pattern of this.commandPatterns) {
      for (const regex of pattern.patterns) {
        const matches = transcript.match(regex);
        if (matches) {
          try {
            const result = await pattern.action(matches, this.playclone);
            return pattern.response(result);
          } catch (error) {
            return {
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              speak: true,
              emotion: 'error'
            };
          }
        }
      }
    }

    // No pattern matched - try to be helpful
    return {
      text: `I don't understand "${transcript}". Try saying "help" for available commands.`,
      speak: true,
      emotion: 'neutral'
    };
  }

  async processMultipleCommands(commands: VoiceCommand[]): Promise<VoiceResponse[]> {
    const responses: VoiceResponse[] = [];
    
    for (const command of commands) {
      const response = await this.processVoiceCommand(command);
      responses.push(response);
      
      // Add a small delay between commands
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return responses;
  }

  startListening(): void {
    this.isListening = true;
  }

  stopListening(): void {
    this.isListening = false;
  }

  isActive(): boolean {
    return this.isListening;
  }

  updateSettings(settings: Partial<typeof this.voiceSettings>): void {
    this.voiceSettings = { ...this.voiceSettings, ...settings };
  }

  getSettings(): typeof this.voiceSettings {
    return { ...this.voiceSettings };
  }

  // Voice command builder for complex operations
  buildComplexCommand(steps: string[]): VoiceCommand[] {
    return steps.map(step => ({
      transcript: step,
      confidence: 1.0
    }));
  }

  // Natural language understanding helpers
  parseIntent(transcript: string): {
    intent: string;
    entities: Record<string, string>;
    confidence: number;
  } {
    const intents = {
      navigation: /^(go|navigate|open|visit)/i,
      interaction: /^(click|tap|press|select)/i,
      input: /^(type|enter|fill|input)/i,
      extraction: /^(read|get|extract|what)/i,
      control: /^(back|forward|refresh|reload)/i,
      search: /^(search|find|look)/i
    };

    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(transcript)) {
        return {
          intent,
          entities: this.extractEntities(transcript, intent),
          confidence: 0.9
        };
      }
    }

    return {
      intent: 'unknown',
      entities: {},
      confidence: 0.1
    };
  }

  private extractEntities(transcript: string, intent: string): Record<string, string> {
    const entities: Record<string, string> = {};

    // Extract quoted strings
    const quotedMatches = transcript.match(/["']([^"']+)["']/g);
    if (quotedMatches) {
      entities.value = quotedMatches[0].replace(/["']/g, '');
    }

    // Extract URLs
    const urlMatch = transcript.match(/(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b/);
    if (urlMatch) {
      entities.url = urlMatch[0];
    }

    // Extract element descriptions
    if (intent === 'interaction' || intent === 'input') {
      const elementMatch = transcript.match(/(?:the\s+)?([a-z]+\s+(?:button|link|field|input|box|menu|tab))/i);
      if (elementMatch) {
        entities.element = elementMatch[1];
      }
    }

    return entities;
  }
}