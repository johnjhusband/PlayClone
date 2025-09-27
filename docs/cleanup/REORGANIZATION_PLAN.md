# PlayClone Root Directory Reorganization Plan

## Current Problem
**62 files in root directory!** This is way too cluttered.

## Files That MUST Stay in Root (8 files)
```
package.json          # NPM config
package-lock.json     # NPM lock file
tsconfig.json         # TypeScript config
README.md             # Main documentation
.gitignore            # Git config (if exists)
LICENSE               # License file (if exists)
mcp-server-v2.cjs     # Currently running MCP server (keep for now)
claude_mcp_config.json # MCP config (keep for now)
```

## Reorganization Plan

### 1. `/docs/` - All Documentation (20+ files)
```
docs/
├── api/
│   ├── API_REFERENCE.md
│   └── USAGE_GUIDE.md
├── development/
│   ├── CONTRIBUTING.md
│   ├── AI_DEVELOPMENT_GUIDE_2024_2025.md
│   ├── NPM_PUBLISH_GUIDE.md
│   └── PLAYWRIGHT_GUIDE.md
├── project/
│   ├── PRD_PLAYCLONE.md
│   ├── PROJECT_STATUS.md
│   ├── ROADMAP_v1.3.0.md
│   ├── TODO.md
│   └── PROMPT.md
├── releases/
│   └── RELEASE_NOTES_v1.2.0.md
├── reports/
│   ├── TEST_REPORT_FINAL.md
│   ├── TEST_REPORT.md
│   ├── V1.3.0_TEST_REPORT.md
│   └── self-test-output.txt
├── cleanup/
│   ├── CLEANUP_ANALYSIS.md
│   ├── CLEANUP_COMPLETE.md
│   ├── REORGANIZATION_PLAN.md
│   └── FIX_PLAN.md
└── notes/
    ├── CLAUDE.md
    └── CLAUDE_NOTES.md
```

### 2. `/tests/` - All Test Files (15+ files)
```
tests/
├── integration/
│   ├── test-ku-comprehensive.js
│   ├── test-import.mjs
│   └── visible-test.js
├── unit/
│   ├── test-simple.ts
│   ├── test-debug.ts
│   ├── quick-test.ts
│   ├── test-back-navigation.ts
│   └── test-back-nav.ts
├── fixtures/
│   └── test-errors.html
└── scripts/
    └── run-self-test.js
```

### 3. `/servers/` - All Server Files (8 files)
```
servers/
├── mcp/
│   ├── mcp-server.cjs
│   ├── mcp-server.mjs
│   ├── mcp-server-test.mjs
│   └── mcp-test-simple.js
├── api/
│   ├── rest-api-server.js
│   ├── graphql-server.js
│   └── webdriver-bidi-server.js
└── config/
    └── playclone.config.example.json
```

### 4. `/deployment/` - Docker & CI/CD (8 files)
```
deployment/
├── docker/
│   ├── Dockerfile.browserPool
│   ├── Dockerfile.test
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── docker-compose.test.yml
│   └── docker-compose-manager.sh
└── ci/
    └── azure-pipelines.yml
```

### 5. `/scripts/` - Utility Scripts (2 files)
```
scripts/
├── upload-workflows.sh
└── fix-v13-methods.js
```

### 6. `/assets/images/` - Screenshots & Images (6 files)
```
assets/
└── images/
    ├── example-screenshot.png
    ├── playclone-github-screenshot.png
    ├── playclone-self-test-screenshot.png
    ├── test-fullpage.png
    ├── test-screenshot.png
    └── visible-test.png
```

### 7. Files to Remove/Gitignore
```
tsconfig.tsbuildinfo   # Build artifact - add to .gitignore
```

## Final Root Directory (Clean!)
```
PlayClone/
├── src/               # Source code
├── dist/              # Built files
├── docs/              # All documentation
├── tests/             # All tests
├── servers/           # Server implementations
├── deployment/        # Docker & CI/CD
├── scripts/           # Utility scripts
├── examples/          # Example usage
├── vscode-extension/  # VS Code extension
├── archive/           # Old files (temporary)
├── assets/            # Images and resources
├── node_modules/      # Dependencies
├── package.json       # NPM config
├── package-lock.json  # NPM lock
├── tsconfig.json      # TypeScript config
├── README.md          # Main readme
├── mcp-server-v2.cjs  # Active MCP server (for now)
└── claude_mcp_config.json # MCP config (for now)
```

## Result
- **Before**: 62 files in root
- **After**: 8 files in root (only essentials)
- **Benefit**: Clean, organized, professional structure