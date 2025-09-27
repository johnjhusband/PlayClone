# PlayClone Cleanup Analysis

## Current Structure Analysis

### File Count Summary
- **38 example files** in examples/
- **24 test files** in root (test*.js)
- **10 demo files** in root (demo*.js/ts)
- **19 MD files** in root
- **11 MD files** in docs/
- **144MB vscode-extension** (huge!)
- **40 checkpoint files** (session artifacts)
- **28MB downloads** folder

## Current Issues

1. **Root Directory Chaos**: 72+ files directly in root
2. **Duplicate Test Files**: Tests scattered everywhere (root, examples/, tests/)
3. **Redundant Documentation**: Multiple overlapping MD files
4. **Huge VSCode Extension**: 144MB - likely not needed
5. **Session Artifacts**: Checkpoints folder with 40+ JSON files
6. **Mixed Demo/Example Files**: No clear distinction

## Core Functional Files

### Essential Core
```
src/
  ├── index.ts (10KB) - Main entry point
  ├── PlayClone.ts (209KB!) - Monolithic main class
  └── types.ts (4KB) - Type definitions

dist/ - Compiled output (6MB)

package.json, tsconfig.json - Config files
```

### MCP Server
```
mcp-server-v2.cjs - Currently running MCP server
claude_mcp_config.json - MCP configuration
```

### Key Documentation
```
README.md - Main documentation
API_REFERENCE.md - API documentation
USAGE_GUIDE.md - User guide
PRD_PLAYCLONE.md - Product requirements
```

## Proposed New Structure

```
playclone/
├── src/                     # Source code
│   ├── core/               # Core PlayClone functionality
│   │   ├── browser.ts      # Browser control
│   │   ├── selectors.ts    # Natural language selectors
│   │   └── actions.ts      # Click, type, etc.
│   ├── mcp/                # MCP server components
│   │   ├── server.js       # MCP server
│   │   └── config.json     # MCP config
│   ├── extraction/         # Data extraction
│   │   ├── errors.ts       # Error capture
│   │   └── content.ts      # Content extraction
│   └── index.ts            # Main entry
│
├── tests/                   # All tests
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── examples/           # Example usage tests
│
├── docs/                    # Documentation
│   ├── api/                # API docs
│   ├── guides/             # User guides
│   └── development/        # Dev docs
│
├── examples/                # Clean examples
│   ├── basic/              # Basic usage
│   ├── advanced/           # Advanced features
│   └── real-world/         # Real app testing
│
├── scripts/                 # Build/utility scripts
│   ├── build.js
│   └── clean.js
│
├── dist/                    # Build output (gitignored)
├── .playclone/             # Runtime data (gitignored)
│   ├── cache/
│   ├── sessions/
│   └── checkpoints/
│
└── [Config files in root]  # package.json, tsconfig.json, etc.
```

## Files to Archive/Remove

### Definitely Remove
- checkpoints/ (runtime artifacts)
- downloads/ (28MB of downloaded files)
- .test-audit/, .wasm-cache-test/ (test artifacts)
- All demo-*.js/ts files (move best ones to examples/)

### Archive for Reference
- azure-pipelines.yml, docker-compose files (if not actively used)
- kubernetes/, helm/ folders (unless deploying to k8s)
- generated-tests/ (old test artifacts)

### Consolidate
- Merge all test*.js files into tests/ folder
- Combine overlapping documentation
- Merge demo/example files into organized examples/

## Features to Complete and Integrate

### 1. VSCode Extension (KEEP - Valuable!)
- **Status**: Functional recorder/debugger extension
- **Action**: Keep and document usage
- **Location**: vscode-extension/

### 2. AI Integration (COMPLETE)
- **Status**: Partially implemented in ai-integration-improvements.js
- **Action**: Integrate into main codebase
- **Features**: Search engines, form filling, data extraction

### 3. Docker/Kubernetes Deployment (COMPLETE)
- **Status**: Full configs present but not integrated
- **Action**: Test and document deployment
- **Files**: docker-compose.yml, kubernetes/*.yaml, helm/

### 4. WASM Optimization (FIX)
- **Status**: Errors with malloc export
- **Action**: Fix WASM module or disable if not critical

### 5. Plugin System (IMPLEMENT)
- **Status**: Folders exist but empty
- **Action**: Create plugin architecture

## Action Plan

### Phase 1: Backup & Clean
1. Create full backup
2. Remove obvious artifacts (checkpoints, downloads, cache)
3. Archive vscode-extension

### Phase 2: Reorganize Core
1. Split PlayClone.ts (209KB!) into logical modules
2. Move all tests to tests/ folder
3. Organize examples properly

### Phase 3: Documentation
1. Consolidate duplicate docs
2. Update README with new structure
3. Create MIGRATION.md for structure changes

### Phase 4: Integration
1. Review incomplete features
2. Integrate useful ones
3. Document or remove others

## Size Reduction Potential

Current: 405MB total
- Keep vscode-extension: 144MB (valuable tool)
- Remove downloads: -28MB
- Clean node_modules: -170MB (reinstall)
- Remove artifacts: ~-5MB

**Potential final size: ~200MB** (with VSCode ext, without node_modules)