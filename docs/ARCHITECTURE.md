# PlayClone Architecture

## Overview

PlayClone is a browser automation framework designed specifically for AI assistants, providing a natural language interface to control web browsers without requiring code generation.

## High-Level Architecture

```mermaid
graph TB
    AI[AI Assistant] --> PC[PlayClone Core]
    PC --> BM[Browser Manager]
    PC --> SM[Session Manager]
    PC --> EL[Element Locator]
    PC --> AE[Action Executor]
    PC --> DE[Data Extractor]
    PC --> STM[State Manager]
    
    BM --> PW[Playwright Core]
    PW --> CR[Chromium]
    PW --> FF[Firefox]
    PW --> WK[WebKit]
    
    EL --> ATP[Accessibility Tree Parser]
    EL --> FM[Fuzzy Matcher]
    EL --> EN[Element Normalizer]
    
    AE --> CL[Click Actions]
    AE --> FI[Form Interactions]
    AE --> NAV[Navigation]
    AE --> KB[Keyboard/Mouse]
    
    DE --> TXT[Text Extraction]
    DE --> TBL[Table Parser]
    DE --> IMG[Screenshot]
    DE --> FRM[Form Data]
    
    STM --> CHK[Checkpoints]
    STM --> SER[Serialization]
    STM --> RES[Restoration]
```

## Component Architecture

### Core Components

```
┌──────────────────────────────────────────────────────────┐
│                     PlayClone Core                        │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Browser   │  │   Session   │  │   Response  │     │
│  │   Manager   │  │   Manager   │  │  Formatter  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Element   │  │   Action    │  │     Data    │     │
│  │   Locator   │  │  Executor   │  │  Extractor  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │    State    │  │    Error    │  │    Retry    │     │
│  │   Manager   │  │   Handler   │  │    Logic    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

```mermaid
sequenceDiagram
    participant AI as AI Assistant
    participant PC as PlayClone
    participant BM as Browser Manager
    participant EL as Element Locator
    participant AE as Action Executor
    participant RF as Response Formatter
    
    AI->>PC: Natural language command
    PC->>BM: Get browser context
    PC->>EL: Parse element description
    EL->>EL: Normalize description
    EL->>EL: Find matching element
    EL-->>PC: Element handle
    PC->>AE: Execute action
    AE->>BM: Perform browser action
    BM-->>AE: Action result
    AE-->>PC: Raw result
    PC->>RF: Format for AI
    RF-->>PC: Optimized response
    PC-->>AI: JSON response (<1KB)
```

## Module Structure

```
playclone/
├── src/
│   ├── core/
│   │   ├── PlayClone.ts         # Main class
│   │   ├── BrowserManager.ts    # Browser lifecycle
│   │   ├── SessionManager.ts    # Session handling
│   │   └── ResponseFormatter.ts # AI-optimized responses
│   │
│   ├── element/
│   │   ├── ElementLocator.ts    # Element finding
│   │   ├── FuzzyMatcher.ts      # Natural language matching
│   │   ├── AccessibilityTree.ts # A11y tree parsing
│   │   └── ElementNormalizer.ts # Description normalization
│   │
│   ├── actions/
│   │   ├── ActionExecutor.ts    # Action orchestration
│   │   ├── ClickActions.ts      # Click operations
│   │   ├── FormActions.ts       # Form interactions
│   │   ├── NavigationActions.ts # Page navigation
│   │   └── KeyboardActions.ts   # Keyboard/mouse
│   │
│   ├── extraction/
│   │   ├── DataExtractor.ts     # Data extraction
│   │   ├── TextExtractor.ts     # Text content
│   │   ├── TableParser.ts       # Table data
│   │   └── FormExtractor.ts     # Form state
│   │
│   ├── state/
│   │   ├── StateManager.ts      # State management
│   │   ├── Checkpoint.ts        # State snapshots
│   │   ├── Serializer.ts        # State persistence
│   │   └── StateComparator.ts   # State diffing
│   │
│   ├── error/
│   │   ├── ErrorTypes.ts        # Error definitions
│   │   ├── ErrorHandler.ts      # Error handling
│   │   ├── RetryStrategy.ts     # Retry logic
│   │   └── ErrorReporter.ts     # AI-friendly errors
│   │
│   ├── utils/
│   │   ├── AutoWait.ts          # Smart waiting
│   │   ├── TimeoutManager.ts    # Timeout handling
│   │   ├── Logger.ts            # Logging
│   │   └── Helpers.ts           # Utility functions
│   │
│   └── index.ts                 # Main export
│
├── tests/                       # Test files
├── examples/                    # Usage examples
└── docs/                       # Documentation
```

## Class Hierarchy

```mermaid
classDiagram
    class PlayClone {
        -browserManager: BrowserManager
        -sessionManager: SessionManager
        -elementLocator: ElementLocator
        -actionExecutor: ActionExecutor
        -dataExtractor: DataExtractor
        -stateManager: StateManager
        +navigate(url: string)
        +click(element: string)
        +fill(field: string, value: string)
        +getText(selector: string)
        +close()
    }
    
    class BrowserManager {
        -browser: Browser
        -context: BrowserContext
        -page: Page
        +launch(options)
        +newPage()
        +close()
    }
    
    class ElementLocator {
        -fuzzyMatcher: FuzzyMatcher
        -accessibilityParser: AccessibilityParser
        -normalizer: ElementNormalizer
        +find(description: string)
        +findAll(description: string)
    }
    
    class ActionExecutor {
        -autoWait: AutoWait
        -retryLogic: RetryStrategy
        +click(element)
        +fill(element, value)
        +select(element, option)
    }
    
    class DataExtractor {
        +getText(selector)
        +getTable(selector)
        +getForm(selector)
        +screenshot(options)
    }
    
    class StateManager {
        -checkpoints: Map
        +save(name)
        +restore(name)
        +diff(state1, state2)
    }
    
    PlayClone --> BrowserManager
    PlayClone --> ElementLocator
    PlayClone --> ActionExecutor
    PlayClone --> DataExtractor
    PlayClone --> StateManager
```

## Natural Language Processing Pipeline

```
Input: "click the blue submit button at the bottom"
                    │
                    ▼
        ┌──────────────────────┐
        │  Element Normalizer   │
        └──────────────────────┘
                    │
    Extracts: color="blue", action="click",
    text="submit", position="bottom", type="button"
                    │
                    ▼
        ┌──────────────────────┐
        │   Fuzzy Matcher       │
        └──────────────────────┘
                    │
    Scores elements based on attributes
                    │
                    ▼
        ┌──────────────────────┐
        │ Accessibility Parser  │
        └──────────────────────┘
                    │
    Checks ARIA labels, roles
                    │
                    ▼
        ┌──────────────────────┐
        │   Element Selector    │
        └──────────────────────┘
                    │
    Returns best matching element
                    │
                    ▼
           Element Handle
```

## State Management Flow

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Active: Browser Launch
    Active --> Navigating: navigate()
    Navigating --> Ready: Page Loaded
    Ready --> Interacting: User Action
    Interacting --> Ready: Action Complete
    Ready --> Checkpoint: saveState()
    Checkpoint --> Ready: State Saved
    Ready --> Restoring: restoreState()
    Restoring --> Ready: State Restored
    Ready --> Idle: close()
    Idle --> [*]
```

## Error Handling Strategy

```
                Error Occurs
                     │
                     ▼
            ┌─────────────────┐
            │ Error Classifier │
            └─────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Retryable    Recoverable   Fatal
        │            │            │
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │  Retry  │  │ Recover │  │  Report │
   │  Logic  │  │Strategy │  │  Error  │
   └─────────┘  └─────────┘  └─────────┘
        │            │            │
        ▼            ▼            ▼
   Try Again    Alternative    AI Response
                  Approach      with Help
```

## Auto-Wait Mechanism

```mermaid
graph LR
    A[Action Request] --> B{Element Ready?}
    B -->|No| C[Wait for Visibility]
    C --> D{Visible?}
    D -->|No| E[Wait for DOM]
    E --> F{In DOM?}
    F -->|No| G[Retry with Backoff]
    G --> B
    F -->|Yes| C
    D -->|Yes| H[Check Interactable]
    H --> I{Can Interact?}
    I -->|No| J[Wait for Enabled]
    J --> H
    I -->|Yes| K[Check Stability]
    K --> L{Position Stable?}
    L -->|No| M[Wait for Animation]
    M --> K
    L -->|Yes| N[Execute Action]
    B -->|Yes| H
```

## Browser Pool Architecture

```
┌────────────────────────────────────────────┐
│              Browser Pool                   │
├────────────────────────────────────────────┤
│                                            │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐│
│   │ Browser  │  │ Browser  │  │ Browser  ││
│   │Instance 1│  │Instance 2│  │Instance 3││
│   │  (idle)  │  │ (active) │  │  (idle)  ││
│   └──────────┘  └──────────┘  └──────────┘│
│                                            │
│   ┌────────────────────────────────────┐  │
│   │         Pool Manager                │  │
│   ├────────────────────────────────────┤  │
│   │ • Lifecycle Management             │  │
│   │ • Health Monitoring                │  │
│   │ • Resource Allocation              │  │
│   │ • Cleanup & Recovery               │  │
│   └────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

## Response Optimization Pipeline

```
    Raw Browser Response (10KB+)
              │
              ▼
    ┌─────────────────────┐
    │   Data Extraction   │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │  Remove Redundancy  │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │   Compress Keys     │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │  Truncate if Needed │
    └─────────────────────┘
              │
              ▼
    AI-Optimized Response (<1KB)
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        DEV[TypeScript Source] --> BUILD[Build Process]
        BUILD --> DIST[Dist Package]
    end
    
    subgraph "NPM Registry"
        DIST --> NPM[npm Package]
    end
    
    subgraph "User Environment"
        NPM --> INSTALL[npm install]
        INSTALL --> NODE[Node.js App]
        NODE --> PC[PlayClone Instance]
    end
    
    subgraph "Browser Layer"
        PC --> PW[Playwright Core]
        PW --> CHROME[Chromium]
        PW --> FIREFOX[Firefox]
        PW --> WEBKIT[WebKit]
    end
```

## Security Architecture

```
┌──────────────────────────────────────┐
│         Security Layer                │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────┐   │
│  │   Input Validation           │   │
│  │   • URL Sanitization         │   │
│  │   • Selector Validation      │   │
│  │   • Script Injection Block   │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │   Sandbox Execution          │   │
│  │   • Isolated Contexts        │   │
│  │   • Limited Permissions      │   │
│  │   • Resource Limits          │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │   Data Protection            │   │
│  │   • No Credential Storage    │   │
│  │   • Encrypted Communication  │   │
│  │   • Session Isolation        │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

## Performance Monitoring

```mermaid
graph LR
    A[Metrics Collection] --> B[Performance Monitor]
    B --> C{Threshold Check}
    C -->|Normal| D[Continue]
    C -->|Warning| E[Log Warning]
    C -->|Critical| F[Alert & Optimize]
    
    B --> G[Metrics Store]
    G --> H[Analytics]
    H --> I[Optimization Recommendations]
```

## Testing Architecture

```
┌─────────────────────────────────────────┐
│            Test Suite                   │
├─────────────────────────────────────────┤
│                                         │
│  Unit Tests        Integration Tests    │
│  ┌──────────┐      ┌──────────────┐   │
│  │ Element  │      │   Browser     │   │
│  │ Locator  │      │   Actions     │   │
│  └──────────┘      └──────────────┘   │
│  ┌──────────┐      ┌──────────────┐   │
│  │  Fuzzy   │      │     Data      │   │
│  │ Matcher  │      │  Extraction   │   │
│  └──────────┘      └──────────────┘   │
│                                         │
│  E2E Tests         Performance Tests    │
│  ┌──────────┐      ┌──────────────┐   │
│  │ Complete │      │   Load Test   │   │
│  │Workflows │      │   Benchmarks  │   │
│  └──────────┘      └──────────────┘   │
└─────────────────────────────────────────┘
```

## AI Integration Points

```mermaid
graph TB
    subgraph "AI Assistant Layer"
        AI1[Claude]
        AI2[GPT]
        AI3[Custom AI]
    end
    
    subgraph "PlayClone API"
        API[Natural Language API]
        FUNC[Function Calls]
        RESP[JSON Responses]
    end
    
    subgraph "Browser Control"
        CTRL[Browser Actions]
        DATA[Data Extraction]
        STATE[State Management]
    end
    
    AI1 --> API
    AI2 --> API
    AI3 --> API
    API --> FUNC
    FUNC --> CTRL
    FUNC --> DATA
    FUNC --> STATE
    CTRL --> RESP
    DATA --> RESP
    STATE --> RESP
    RESP --> AI1
    RESP --> AI2
    RESP --> AI3
```

## Memory Management

```
┌──────────────────────────────────────┐
│         Memory Manager                │
├──────────────────────────────────────┤
│                                      │
│  Browser Instances                   │
│  ┌────────────────────────────┐     │
│  │ Active: 3 | Idle: 2        │     │
│  │ Memory: 512MB / 1GB limit  │     │
│  └────────────────────────────┘     │
│                                      │
│  Page Cache                          │
│  ┌────────────────────────────┐     │
│  │ Cached Pages: 10           │     │
│  │ Cache Size: 50MB           │     │
│  └────────────────────────────┘     │
│                                      │
│  State Storage                       │
│  ┌────────────────────────────┐     │
│  │ Checkpoints: 5             │     │
│  │ Storage: 10MB              │     │
│  └────────────────────────────┘     │
│                                      │
│  Garbage Collection                  │
│  ┌────────────────────────────┐     │
│  │ Next GC: 5 min             │     │
│  │ Collected: 200MB           │     │
│  └────────────────────────────┘     │
└──────────────────────────────────────┘
```

## Configuration Flow

```mermaid
graph TD
    A[Default Config] --> B[User Config]
    B --> C[Environment Variables]
    C --> D[Runtime Overrides]
    D --> E[Final Configuration]
    
    E --> F{Validation}
    F -->|Valid| G[Initialize PlayClone]
    F -->|Invalid| H[Configuration Error]
    H --> I[Use Defaults]
    I --> G
```

## Future Architecture Considerations

### Planned Enhancements

1. **Plugin System**
   - Custom action plugins
   - Element matcher plugins
   - Data extractor plugins

2. **Distributed Execution**
   - Multi-machine browser pools
   - Load balancing
   - Fault tolerance

3. **Advanced AI Features**
   - Computer vision for element detection
   - ML-based element prediction
   - Adaptive learning from usage patterns

4. **Performance Optimizations**
   - WebAssembly modules for critical paths
   - Native bindings for performance
   - GPU acceleration for vision tasks

### Scalability Considerations

```mermaid
graph TB
    subgraph "Single Instance"
        SI[PlayClone] --> B1[Browser]
    end
    
    subgraph "Scaled Architecture"
        LB[Load Balancer]
        LB --> PC1[PlayClone 1]
        LB --> PC2[PlayClone 2]
        LB --> PC3[PlayClone N]
        
        PC1 --> BP1[Browser Pool]
        PC2 --> BP2[Browser Pool]
        PC3 --> BP3[Browser Pool]
        
        PC1 --> REDIS[Redis Cache]
        PC2 --> REDIS
        PC3 --> REDIS
        
        PC1 --> S3[S3 State Storage]
        PC2 --> S3
        PC3 --> S3
    end
```

## Summary

PlayClone's architecture is designed with the following principles:

1. **AI-First**: Natural language interface, token-optimized responses
2. **Modular**: Clear separation of concerns, pluggable components
3. **Robust**: Comprehensive error handling, retry strategies
4. **Performant**: Connection pooling, smart caching, lazy loading
5. **Maintainable**: Clear structure, extensive documentation
6. **Scalable**: Designed for both single-instance and distributed use

The architecture enables AI assistants to control browsers naturally while maintaining performance, reliability, and security.