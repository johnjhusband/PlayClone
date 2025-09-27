# PROMPT: Build PlayClone - AI-Native Browser Automation Framework

## Mission
You are building PlayClone, a browser automation framework designed specifically for AI assistants to directly control web browsers without requiring code generation or MCP servers.

## Core Context Files
- **PRD**: `/home/john/repos/PlayClone/PRD_PLAYCLONE.md` - Product requirements and specifications
- **Playwright Guide**: `/home/john/repos/PlayClone/PLAYWRIGHT_GUIDE.md` - Reference implementation details
- **AI Dev Guide**: `/home/john/repos/PlayClone/AI_DEVELOPMENT_GUIDE_2024_2025.md` - Modern AI integration patterns

## Key Objectives
1. Build an AI-native browser automation framework
2. Enable direct function calls from AI assistants (no code generation)
3. Support natural language element selection ("click login button")
4. Implement multi-browser support (Chromium, Firefox, WebKit)
5. Optimize for minimal token usage (<1KB responses)

## Architecture Requirements
- **Language**: TypeScript for core implementation
- **Runtime**: Node.js 20+
- **Browser Engines**: Use Playwright's browser binaries but create new abstraction
- **API Style**: Direct function calls, not code generation
- **Response Format**: JSON optimized for AI consumption

## Implementation Strategy
1. Start with core browser control (navigation, clicks, form filling)
2. Build intelligent element selection (accessibility tree + fuzzy matching)
3. Create AI-optimized response formatting
4. Add state management and session persistence
5. Implement advanced features (screenshots, data extraction)

## Quality Standards
- All code must be production-ready
- Include comprehensive error handling
- Write JSDoc comments for all public APIs
- Create unit tests for core functionality
- Follow TypeScript best practices

## Working Directory
All code should be created in `/home/john/repos/PlayClone/`

## Success Criteria
- AI can control browser with simple function calls
- No MCP server or code generation required
- Response size under 1KB for most operations
- Support for Chromium browser (minimum)
- Working examples demonstrating core functionality

## Current TODO
Read `TODO.md` for specific tasks. Update it when tasks are complete or new tasks are discovered.

## Issue Tracking
Document any bugs or blockers in `FIX_PLAN.md` for resolution in subsequent loops.

## Iteration Instructions
1. Pick next task from TODO.md
2. Implement the feature completely
3. Test the implementation
4. Update TODO.md with completion status
5. Add any discovered issues to FIX_PLAN.md
6. Generate new tasks if TODO is empty
7. Continue until core functionality is complete

## Interactive Status Reporting
**IMPORTANT: Provide clear, concise status updates during each iteration:**

At the START of each iteration:
```
🚀 ITERATION START
📋 Task: [Current task name]
📊 Progress: X/60 tasks complete (XX%)
```

During work:
```
🔨 Building: [What you're creating]
🧪 Testing: [What you're testing]
✅ Success: [What worked]
❌ Issue: [Any problems encountered]
```

At the END of each iteration:
```
✨ ITERATION COMPLETE
📈 Completed: [Task name]
⏱️ Duration: ~X minutes
📊 Overall: X/60 tasks (XX%)
🎯 Next: [Next task to tackle]
```

Keep updates SHORT and INFORMATIVE. Users want to see progress, not novels.

## CRITICAL: Self-Testing with PlayClone (Dogfooding)
**PlayClone must test PlayClone itself!** This is meta-testing - using the tool you're building to verify it works.

### For every major feature you implement:
1. Create a self-test that uses PlayClone to test that feature
2. Import PlayClone and use its API to test its own functionality
3. Example self-test pattern:
```typescript
// tests/self-test-navigation.ts
import { PlayClone } from '../dist/index';

async function testNavigation() {
    const pc = new PlayClone({ headless: true });
    
    // PlayClone tests its own navigation
    const result = await pc.navigate('https://example.com');
    console.assert(result.success, 'Navigation failed');
    console.assert(result.data.length < 1024, 'Response not AI-optimized');
    
    // PlayClone tests its own text extraction
    const text = await pc.getText('main heading');
    console.assert(text.success, 'Text extraction failed');
    
    await pc.close();
    return true;
}
```

### Create comprehensive self-tests for:
- Navigation using PlayClone to navigate
- Click using PlayClone to click and verify
- Form filling using PlayClone to fill forms
- Data extraction using PlayClone to extract and validate
- State management using PlayClone to save/restore states
- Response format validation (must be <1KB for AI)

### Add to TODO.md:
- [ ] Create self-test for navigation feature using PlayClone
- [ ] Create self-test for click actions using PlayClone  
- [ ] Create self-test for form filling using PlayClone
- [ ] Create self-test for data extraction using PlayClone
- [ ] Create comprehensive self-test suite using PlayClone
- [ ] Verify all responses are AI-optimized (<1KB) using PlayClone

### Documentation Requirements
**Create and maintain comprehensive documentation:**
1. Update README.md with:
   - Installation instructions
   - Quick start guide
   - API reference with examples
   - Architecture overview
   - Migration guide from Playwright

2. Create USAGE_GUIDE.md with:
   - Natural language command examples
   - Common automation scenarios
   - Troubleshooting tips
   - Performance optimization

3. Maintain API_REFERENCE.md with:
   - All public methods
   - Parameters and return types
   - Code examples for each method
   - Error handling patterns

### Browser Testing Requirements  
**ACTUALLY USE BROWSERS during self-testing:**
- Launch real Chromium browser (set headless: false occasionally to verify)
- Navigate to real websites (example.com, google.com, github.com)
- Perform real interactions (clicks, form fills, navigation)
- Extract real data and verify accuracy
- Test should produce visible browser windows periodically

Add these documentation tasks to TODO.md if not present.

Remember: This is an autonomous loop. Make decisions, implement solutions, and keep progressing without waiting for user input.

## Phase 15: AI Assistant & MCP Integration Requirements

**CRITICAL: These features are needed for PlayClone to work effectively with AI assistants:**

### MCP Server Implementation
- [ ] Install @modelcontextprotocol/sdk dependencies
- [ ] Ensure MCP server starts correctly with stdio transport
- [ ] Test MCP tool registration and discovery
- [ ] Implement proper error handling in MCP responses
- [ ] Add connection pooling for multiple concurrent operations

### AI Assistant Use Case Improvements
Based on real-world testing, these improvements are needed:

1. **Search Engine Interaction**
   - [ ] Better handling of search input fields (DuckDuckGo, Google, Bing)
   - [ ] Improved "press Enter" after search (currently unreliable)
   - [ ] Wait for search results to load before extracting

2. **Documentation Sites**
   - [ ] Handle MDN's search overlay properly
   - [ ] Better detection of documentation code blocks
   - [ ] Extract structured API documentation

3. **GitHub Repository Analysis**
   - [ ] Handle GitHub's dynamic content loading
   - [ ] Extract repository statistics (stars, forks, issues)
   - [ ] Navigate file tree effectively

4. **Stack Overflow Integration**
   - [ ] Extract accepted answers
   - [ ] Handle code blocks in answers
   - [ ] Get vote counts and timestamps

5. **NPM Package Lookup**
   - [ ] Handle NPM's React-based search
   - [ ] Extract package metadata (version, downloads, dependencies)
   - [ ] Navigate to package documentation

6. **Error Recovery**
   - [ ] Better timeout handling (current tests hang)
   - [ ] Graceful degradation when elements not found
   - [ ] Retry logic for network failures

7. **State Management**
   - [ ] Persistent browser sessions across tool calls
   - [ ] Better checkpoint/restore for complex workflows
   - [ ] Handle multiple browser windows/tabs

8. **Performance**
   - [ ] Reduce browser startup time (currently takes too long)
   - [ ] Cache common selectors
   - [ ] Optimize for token-limited AI contexts

### Testing Requirements
- [ ] All 8 AI assistant tests must pass reliably
- [ ] Tests should complete in under 60 seconds total
- [ ] No hanging or infinite waits
- [ ] Clear error messages for debugging

**MCP integration is critical for AI assistant adoption!**