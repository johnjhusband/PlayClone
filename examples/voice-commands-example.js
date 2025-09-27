const { PlayClone } = require('../dist/index');
const { VoiceCommandHandler } = require('../dist/ai/voice/VoiceCommandHandler');
const { NaturalLanguageParser } = require('../dist/ai/voice/NaturalLanguageParser');
const { VoiceFeedback } = require('../dist/ai/voice/VoiceFeedback');

async function demonstrateVoiceCommands() {
  console.log('🎤 PlayClone Voice Command Demo\n');
  
  const pc = new PlayClone({ headless: false });
  const voiceHandler = new VoiceCommandHandler(pc);
  const nlpParser = new NaturalLanguageParser();
  const feedback = new VoiceFeedback();

  try {
    // Start voice mode
    await feedback.startConversation();
    voiceHandler.startListening();
    
    // Simulate voice commands (in real usage, these would come from speech recognition)
    const voiceCommands = [
      { transcript: "open google.com", confidence: 0.95 },
      { transcript: "search for artificial intelligence", confidence: 0.92 },
      { transcript: "click the first search result", confidence: 0.88 },
      { transcript: "scroll down", confidence: 0.90 },
      { transcript: "take a screenshot", confidence: 0.93 },
      { transcript: "go back", confidence: 0.96 },
      { transcript: "what can you do", confidence: 0.89 }
    ];

    console.log('📝 Processing voice commands:\n');
    
    for (const command of voiceCommands) {
      console.log(`\n🎙️ User: "${command.transcript}"`);
      
      // Parse the natural language
      const parsed = nlpParser.parse(command.transcript);
      console.log(`📊 Parsed: Action="${parsed.action}", Target="${parsed.target || 'N/A'}", Confidence=${parsed.confidence.toFixed(2)}`);
      
      // Show thinking feedback
      if (parsed.action !== 'unknown') {
        await feedback.thinkingFeedback();
      }
      
      // Process the command
      const response = await voiceHandler.processVoiceCommand(command);
      
      // Provide feedback
      console.log(`🤖 Assistant: ${response.text}`);
      
      if (response.emotion === 'success') {
        await feedback.successFeedback(response.text);
      } else if (response.emotion === 'error') {
        await feedback.errorFeedback(response.text);
      } else {
        await feedback.speak(response.text);
      }
      
      // Small delay between commands for demo
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log('\n\n📋 Advanced Voice Features Demo:\n');

    // Demonstrate complex command building
    console.log('🔧 Building complex command sequence:');
    const complexCommands = voiceHandler.buildComplexCommand([
      "navigate to github.com",
      "search for playclone",
      "click the first repository",
      "scroll to readme",
      "take a screenshot"
    ]);
    
    console.log('📦 Complex command sequence created with', complexCommands.length, 'steps');

    // Demonstrate NLP features
    console.log('\n🧠 Natural Language Understanding:');
    
    const testPhrases = [
      "I want to go to the Amazon website",
      "Can you please click on the login button",
      "Type 'hello world' in the search field",
      "Find information about machine learning"
    ];

    for (const phrase of testPhrases) {
      const intent = nlpParser.parseIntent(phrase);
      console.log(`\n  Input: "${phrase}"`);
      console.log(`  Intent: ${intent.intent} (confidence: ${intent.confidence.toFixed(2)})`);
      console.log(`  Entities:`, intent.entities);
    }

    // Demonstrate context-aware parsing
    console.log('\n🔄 Context-Aware Command Processing:');
    
    const context = {
      currentPage: 'https://www.google.com',
      availableElements: ['search box', 'search button', 'I\'m Feeling Lucky button'],
      previousAction: 'navigate'
    };

    const contextualCommand = "click the search button";
    const parsedWithContext = nlpParser.parse(contextualCommand, context);
    const adjustedConfidence = nlpParser.adjustConfidence(parsedWithContext, context);
    
    console.log(`  Command: "${contextualCommand}"`);
    console.log(`  Base confidence: ${parsedWithContext.confidence.toFixed(2)}`);
    console.log(`  Adjusted confidence: ${adjustedConfidence.toFixed(2)}`);
    console.log(`  (Boosted because element is available)`);

    // Demonstrate suggestions
    console.log('\n💡 Command Suggestions:');
    const partialInput = "click";
    const suggestions = nlpParser.getSuggestions(partialInput, context);
    console.log(`  For "${partialInput}":`);
    suggestions.forEach(s => console.log(`    - ${s}`));

    // Demonstrate voice feedback customization
    console.log('\n🔊 Voice Feedback Customization:');
    
    // Change voice settings
    feedback.updateTTSOptions({
      rate: 1.2,
      pitch: 1.1,
      voice: 'female-1'
    });
    
    // Change verbosity
    console.log('  Setting verbosity to minimal...');
    feedback.updateFeedbackOptions({ verbosity: 'minimal' });
    await feedback.successFeedback('Navigation completed successfully');
    
    console.log('  Setting verbosity to detailed...');
    feedback.updateFeedbackOptions({ verbosity: 'detailed' });
    await feedback.successFeedback('Navigation completed');

    // Demonstrate emotion-based speech
    console.log('\n😊 Emotion-Based Speech:');
    const emotions = ['neutral', 'happy', 'excited', 'calm'];
    for (const emotion of emotions) {
      const emotionSettings = feedback.applyEmotion('Hello, how can I help you?', emotion);
      console.log(`  ${emotion}: rate=${emotionSettings.rate}, pitch=${emotionSettings.pitch}`);
    }

    // Voice characteristics selection
    console.log('\n🎭 Voice Selection:');
    const voiceChoice = feedback.selectVoiceByCharacteristics({
      gender: 'female',
      age: 'young',
      style: 'assistant'
    });
    console.log(`  Selected voice: ${voiceChoice}`);

    // Available voices
    const voices = feedback.getAvailableVoices();
    console.log(`  Available voices: ${voices.join(', ')}`);

    // Stop voice mode
    voiceHandler.stopListening();
    await feedback.endConversation();
    
    console.log('\n✅ Voice command demo completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await feedback.errorFeedback(`Error: ${error.message}`);
  } finally {
    await pc.close();
  }
}

// Simulate real-time voice command processing
async function simulateRealTimeVoice() {
  console.log('\n🎙️ Simulating Real-Time Voice Input\n');
  
  const pc = new PlayClone({ headless: false });
  const voiceHandler = new VoiceCommandHandler(pc);
  const feedback = new VoiceFeedback();

  try {
    await feedback.startConversation();
    voiceHandler.startListening();
    
    // Simulate streaming voice input with partial recognition
    const voiceStream = [
      { partial: "nav", confidence: 0.6 },
      { partial: "navigate to", confidence: 0.7 },
      { partial: "navigate to wiki", confidence: 0.8 },
      { final: "navigate to wikipedia", confidence: 0.92 }
    ];

    console.log('📡 Processing streaming voice input:');
    for (const input of voiceStream) {
      if (input.partial) {
        console.log(`  [partial] "${input.partial}" (confidence: ${input.confidence})`);
      } else if (input.final) {
        console.log(`  [final] "${input.final}" (confidence: ${input.confidence})`);
        
        const command = { transcript: input.final, confidence: input.confidence };
        const response = await voiceHandler.processVoiceCommand(command);
        console.log(`  ✅ ${response.text}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } finally {
    voiceHandler.stopListening();
    await pc.close();
  }
}

// Run the demos
(async () => {
  try {
    await demonstrateVoiceCommands();
    await simulateRealTimeVoice();
  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
})();