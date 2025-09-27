export interface TTSOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  language?: string;
}

export interface FeedbackOptions {
  enableSound?: boolean;
  enableVisual?: boolean;
  enableHaptic?: boolean;
  verbosity?: 'minimal' | 'normal' | 'detailed';
}

export class VoiceFeedback {
  private ttsQueue: string[] = [];
  private isProcessing: boolean = false;
  private defaultOptions: TTSOptions = {
    voice: 'default',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    language: 'en-US'
  };
  private feedbackOptions: FeedbackOptions = {
    enableSound: true,
    enableVisual: true,
    enableHaptic: false,
    verbosity: 'normal'
  };

  // Sound patterns for different feedback types
  private soundPatterns = {
    success: { frequency: 800, duration: 200, type: 'sine', repeat: undefined },
    error: { frequency: 300, duration: 400, type: 'square', repeat: undefined },
    warning: { frequency: 500, duration: 300, type: 'triangle', repeat: undefined },
    notification: { frequency: 600, duration: 150, type: 'sine', repeat: undefined },
    thinking: { frequency: 400, duration: 100, type: 'sine', repeat: 3 }
  };

  async speak(text: string, options?: TTSOptions): Promise<void> {
    if (!this.feedbackOptions.enableSound) return;

    const opts = { ...this.defaultOptions, ...options };
    
    // Add to queue
    this.ttsQueue.push(text);
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processQueue(opts);
    }
  }

  private async processQueue(options: TTSOptions): Promise<void> {
    this.isProcessing = true;
    
    while (this.ttsQueue.length > 0) {
      const text = this.ttsQueue.shift()!;
      await this.synthesizeSpeech(text, options);
      
      // Small pause between utterances
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    this.isProcessing = false;
  }

  private async synthesizeSpeech(text: string, options: TTSOptions): Promise<void> {
    // In a real implementation, this would use Web Speech API or a TTS service
    // For now, we'll simulate the timing
    const words = text.split(' ').length;
    const duration = (words * 200) / options.rate!; // Approximate timing
    
    console.log(`[TTS] Speaking: "${text}" (${duration}ms)`);
    
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  async playSound(type: keyof typeof this.soundPatterns): Promise<void> {
    if (!this.feedbackOptions.enableSound) return;

    const pattern = this.soundPatterns[type];
    console.log(`[Sound] Playing ${type} sound: ${pattern.frequency}Hz for ${pattern.duration}ms`);
    
    // Simulate sound playing
    if (pattern.repeat) {
      for (let i = 0; i < pattern.repeat; i++) {
        await new Promise(resolve => setTimeout(resolve, pattern.duration));
        await new Promise(resolve => setTimeout(resolve, 50)); // Gap between repeats
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, pattern.duration));
    }
  }

  showVisualFeedback(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    if (!this.feedbackOptions.enableVisual) return;

    const colors = {
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warning: '\x1b[33m', // Yellow
      info: '\x1b[36m'     // Cyan
    };
    
    const reset = '\x1b[0m';
    const icon = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    
    console.log(`${colors[type]}${icon[type]} ${message}${reset}`);
  }

  async provideHapticFeedback(pattern: 'light' | 'medium' | 'heavy'): Promise<void> {
    if (!this.feedbackOptions.enableHaptic) return;

    const patterns = {
      light: { duration: 10, intensity: 0.3 },
      medium: { duration: 20, intensity: 0.6 },
      heavy: { duration: 30, intensity: 1.0 }
    };
    
    const haptic = patterns[pattern];
    console.log(`[Haptic] Pattern: ${pattern}, Duration: ${haptic.duration}ms, Intensity: ${haptic.intensity}`);
    
    // Simulate haptic feedback timing
    await new Promise(resolve => setTimeout(resolve, haptic.duration));
  }

  // Composite feedback for different scenarios
  async successFeedback(message: string): Promise<void> {
    await Promise.all([
      this.playSound('success'),
      this.speak(this.adjustVerbosity(message, 'success')),
      this.provideHapticFeedback('light')
    ]);
    this.showVisualFeedback(message, 'success');
  }

  async errorFeedback(message: string): Promise<void> {
    await Promise.all([
      this.playSound('error'),
      this.speak(this.adjustVerbosity(message, 'error')),
      this.provideHapticFeedback('heavy')
    ]);
    this.showVisualFeedback(message, 'error');
  }

  async warningFeedback(message: string): Promise<void> {
    await Promise.all([
      this.playSound('warning'),
      this.speak(this.adjustVerbosity(message, 'warning')),
      this.provideHapticFeedback('medium')
    ]);
    this.showVisualFeedback(message, 'warning');
  }

  async thinkingFeedback(): Promise<void> {
    await this.playSound('thinking');
    this.showVisualFeedback('Processing...', 'info');
  }

  private adjustVerbosity(message: string, context: string): string {
    switch (this.feedbackOptions.verbosity) {
      case 'minimal':
        // Just the essential words
        if (context === 'success') return 'Done';
        if (context === 'error') return 'Failed';
        if (context === 'warning') return 'Warning';
        return message.split(' ').slice(0, 3).join(' ');
        
      case 'detailed':
        // Add context and explanation
        if (context === 'success') return `Success. ${message}. Operation completed successfully.`;
        if (context === 'error') return `Error occurred. ${message}. Please try again.`;
        if (context === 'warning') return `Warning. ${message}. Proceed with caution.`;
        return message;
        
      case 'normal':
      default:
        return message;
    }
  }

  // Conversation mode helpers
  async startConversation(): Promise<void> {
    await this.speak('Voice commands ready. How can I help you?');
    this.showVisualFeedback('Voice command mode activated', 'info');
  }

  async endConversation(): Promise<void> {
    await this.speak('Voice commands deactivated. Goodbye!');
    this.showVisualFeedback('Voice command mode deactivated', 'info');
  }

  async confirmAction(action: string): Promise<void> {
    await this.speak(`Confirming: ${action}. Say yes to proceed or no to cancel.`);
    this.showVisualFeedback(`Awaiting confirmation for: ${action}`, 'warning');
  }

  // Interrupt handling
  stopSpeaking(): void {
    this.ttsQueue = [];
    this.isProcessing = false;
    console.log('[TTS] Speech interrupted');
  }

  // Settings management
  updateTTSOptions(options: Partial<TTSOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  updateFeedbackOptions(options: Partial<FeedbackOptions>): void {
    this.feedbackOptions = { ...this.feedbackOptions, ...options };
  }

  getFeedbackOptions(): FeedbackOptions {
    return { ...this.feedbackOptions };
  }

  // Voice selection helpers
  getAvailableVoices(): string[] {
    // In a real implementation, this would query available system voices
    return [
      'default',
      'male-1',
      'male-2',
      'female-1',
      'female-2',
      'child',
      'robot'
    ];
  }

  selectVoiceByCharacteristics(characteristics: {
    gender?: 'male' | 'female' | 'neutral';
    age?: 'child' | 'young' | 'adult' | 'elder';
    style?: 'natural' | 'robotic' | 'assistant';
  }): string {
    // Simple voice selection logic
    if (characteristics.style === 'robotic') return 'robot';
    if (characteristics.age === 'child') return 'child';
    if (characteristics.gender === 'male') return 'male-1';
    if (characteristics.gender === 'female') return 'female-1';
    return 'default';
  }

  // Emotion-based speech adjustments
  applyEmotion(text: string, emotion: 'neutral' | 'happy' | 'sad' | 'excited' | 'calm'): TTSOptions {
    const emotionSettings: Record<string, TTSOptions> = {
      neutral: { rate: 1.0, pitch: 1.0, volume: 1.0 },
      happy: { rate: 1.1, pitch: 1.2, volume: 1.0 },
      sad: { rate: 0.9, pitch: 0.8, volume: 0.8 },
      excited: { rate: 1.3, pitch: 1.3, volume: 1.1 },
      calm: { rate: 0.85, pitch: 0.9, volume: 0.9 }
    };
    
    return emotionSettings[emotion] || emotionSettings.neutral;
  }

  // Accessibility helpers
  async announceForScreenReader(text: string): Promise<void> {
    // Would integrate with screen reader APIs
    console.log(`[A11y] Screen reader announcement: ${text}`);
    await this.speak(text, { rate: 0.9 }); // Slightly slower for clarity
  }

  async provideNavigationFeedback(element: string, action: string): Promise<void> {
    const message = `${action} on ${element}`;
    await this.speak(message);
    this.showVisualFeedback(message, 'info');
  }
}