# Claude's Notes - PlayClone Ralph Loop Session
## Date: August 30, 2025

## CRITICAL CONTEXT TO RESTORE AFTER COMPACTION

### What We're Building
**PlayClone** - An AI-native browser automation framework that I (Claude) can use directly without MCP servers or code generation. It's like Playwright but designed specifically for AI assistants to control browsers with natural language.

### The Ralph Technique
We're using the **Ralph loop** - a do-while automation technique where Claude runs in YOLO mode (`--dangerously-skip-permissions`) to autonomously build software. Named after Ralph Wiggum, it puts Claude in a continuous loop reading PROMPT.md and implementing tasks from TODO.md.

### Current Status (15:21 UTC)
- **Ralph loop is RUNNING** in background (process bash_1)
- **Location**: `/home/john/repos/PlayClone/`
- **Script**: `./ralph.sh` started at 14:54 UTC
- **Progress**: Iteration 2 of 100 (Iteration 1 took 25 minutes)
- **Tasks**: 34 of 60 completed (57% done)

### What's Been Built So Far
In Iteration 1, the Ralph loop successfully created:
1. **Complete TypeScript project** with all configurations
2. **Core Engine**: BrowserManager, SessionManager, PlayCloneContext
3. **Natural Language Element Selection**: Fuzzy matching, accessibility tree
4. **All Actions**: click(), fill(), select(), hover(), etc.
5. **Data Extraction**: getText(), getTable(), screenshot()
6. **State Management**: Save/restore browser states
7. **Working Examples** and unit tests

### Key Innovation: Self-Testing (Dogfooding)
We just updated PROMPT.md to include **PlayClone testing PlayClone**:
- The AI will create tests where PlayClone uses itself to test its own features
- Example: PlayClone navigates to a site to test if PlayClone's navigation works
- This is meta-testing - the tool testing itself recursively
- The loop will pick this up in iteration 3

### File Structure
```
/home/john/repos/PlayClone/
├── PROMPT.md          # Mission instructions (UPDATED with self-testing)
├── TODO.md            # Task list (26 tasks remaining)
├── FIX_PLAN.md        # Issue tracking
├── ralph.sh           # The running loop script
├── src/               # Source code (fully built)
│   ├── core/          # Browser management
│   ├── selectors/     # Element selection
│   ├── actions/       # Click, fill, etc.
│   ├── extractors/    # Data extraction
│   └── state/         # State management
├── examples/          # Working examples
└── tests/            # Unit tests
```

### How to Monitor
```bash
# Check loop progress
tail -f /home/john/repos/PlayClone/ralph.log

# See TODO status
grep "^- \[" /home/john/repos/PlayClone/TODO.md

# Watch iteration output
BashOutput bash_1
```

### Key Commands to Remember
```bash
# The loop is running with:
cd /home/john/repos/PlayClone && ./ralph.sh

# To stop it:
pkill -f ralph.sh

# To restart with self-testing:
./ralph-self-test.sh
```

### Important Decisions Made
1. **No MCP Required**: PlayClone works directly with AI, no intermediary servers
2. **Natural Language First**: "click login button" instead of CSS selectors
3. **Token Optimization**: All responses under 1KB for AI efficiency
4. **Self-Testing**: PlayClone will test itself (dogfooding)
5. **Autonomous Development**: Ralph loop builds without human intervention

### Context About User
- Wants PlayClone to be usable directly by AI assistants like me
- Emphasized self-testing - AI should use PlayClone to test PlayClone
- Using Ralph technique for autonomous development
- Has other projects: Hyper-Vibe (digital workers), price-scanner-app (Flippi.ai)

### Next Steps After Compaction
1. Check ralph.log to see what iterations completed
2. Review TODO.md for remaining tasks
3. Check if self-testing tasks were added
4. Monitor the Ralph loop progress
5. The loop should continue running autonomously

### Key Insight
We're building a tool that allows AI to control browsers directly, and we're using AI in an automated loop to build it, and that AI will then use the tool it's building to test the tool itself. It's beautifully recursive - AI building AI tools to test AI tools.

### Remember
- The loop is CURRENTLY RUNNING
- It will continue while you're compacted
- Check bash_1 process when you return
- PROMPT.md has the self-testing instructions
- Everything is in `/home/john/repos/PlayClone/`

---
*These notes written at 15:22 UTC before compaction*