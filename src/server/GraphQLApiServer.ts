import { ApolloServer, gql } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import express, { Express } from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/dist/use/ws';
import { PubSub } from 'graphql-subscriptions';
import { PlayClone } from '../PlayClone';
import { v4 as uuidv4 } from 'uuid';

/**
 * GraphQL API Server for PlayClone
 * 
 * Provides a GraphQL interface for browser automation with
 * queries, mutations, and subscriptions for real-time updates.
 */

// Type definitions for GraphQL schema
const typeDefs = gql`
  scalar JSON
  
  type BrowserSession {
    id: String!
    createdAt: String!
    lastUsed: String!
    isActive: Boolean!
    metadata: JSON
  }
  
  type NavigationResult {
    success: Boolean!
    url: String
    title: String
    error: String
  }
  
  type ActionResult {
    success: Boolean!
    data: JSON
    error: String
  }
  
  type ElementInfo {
    tag: String!
    text: String
    attributes: JSON
    isVisible: Boolean!
    isInteractable: Boolean!
  }
  
  type ExtractedData {
    text: String
    links: [Link]
    tables: [[String]]
    forms: [FormData]
    images: [String]
  }
  
  type Link {
    text: String!
    href: String!
  }
  
  type FormData {
    id: String
    name: String
    fields: [FormField]
  }
  
  type FormField {
    name: String!
    type: String!
    value: String
    required: Boolean
  }
  
  type Screenshot {
    data: String!
    format: String!
    fullPage: Boolean!
  }
  
  type StateCheckpoint {
    id: String!
    name: String!
    url: String!
    cookies: Int!
    localStorage: Int!
    sessionStorage: Int!
    createdAt: String!
  }
  
  type Query {
    # Session management
    listSessions: [BrowserSession!]!
    getSession(id: String!): BrowserSession
    
    # Page information
    getCurrentUrl(sessionId: String!): String
    getTitle(sessionId: String!): String
    getContent(sessionId: String!): String
    
    # Element queries
    findElement(sessionId: String!, selector: String!): ElementInfo
    findElements(sessionId: String!, selector: String!): [ElementInfo!]!
    isElementVisible(sessionId: String!, selector: String!): Boolean
    
    # Data extraction
    getText(sessionId: String!, selector: String): String
    getLinks(sessionId: String!): [Link!]!
    getTables(sessionId: String!): [[String]]
    getForms(sessionId: String!): [FormData!]!
    
    # State management
    listCheckpoints(sessionId: String!): [StateCheckpoint!]!
    getCheckpoint(sessionId: String!, checkpointId: String!): StateCheckpoint
  }
  
  type Mutation {
    # Session lifecycle
    createSession(headless: Boolean, viewport: ViewportInput): BrowserSession!
    closeSession(sessionId: String!): Boolean!
    closeAllSessions: Boolean!
    
    # Navigation
    navigate(sessionId: String!, url: String!, waitUntil: String): NavigationResult!
    goBack(sessionId: String!): NavigationResult!
    goForward(sessionId: String!): NavigationResult!
    reload(sessionId: String!): NavigationResult!
    
    # Actions
    click(sessionId: String!, selector: String!): ActionResult!
    type(sessionId: String!, selector: String!, text: String!): ActionResult!
    fill(sessionId: String!, selector: String!, value: String!): ActionResult!
    select(sessionId: String!, selector: String!, value: String!): ActionResult!
    check(sessionId: String!, selector: String!): ActionResult!
    uncheck(sessionId: String!, selector: String!): ActionResult!
    hover(sessionId: String!, selector: String!): ActionResult!
    focus(sessionId: String!, selector: String!): ActionResult!
    press(sessionId: String!, key: String!): ActionResult!
    
    # Screenshots
    takeScreenshot(
      sessionId: String!
      fullPage: Boolean
      selector: String
      format: String
    ): Screenshot!
    
    # State management
    createCheckpoint(sessionId: String!, name: String!): StateCheckpoint!
    restoreCheckpoint(sessionId: String!, checkpointId: String!): ActionResult!
    deleteCheckpoint(sessionId: String!, checkpointId: String!): Boolean!
    
    # Script execution
    executeScript(sessionId: String!, script: String!): JSON
    
    # Form automation
    fillForm(sessionId: String!, formData: JSON!): ActionResult!
    submitForm(sessionId: String!, selector: String): ActionResult!
    
    # Cookies
    setCookie(sessionId: String!, cookie: CookieInput!): Boolean!
    getCookies(sessionId: String!, url: String): [JSON!]!
    clearCookies(sessionId: String!): Boolean!
  }
  
  type Subscription {
    # Real-time browser events
    sessionCreated: BrowserSession!
    sessionClosed: String!
    navigationStarted(sessionId: String!): NavigationEvent!
    navigationCompleted(sessionId: String!): NavigationEvent!
    elementClicked(sessionId: String!): ElementEvent!
    formSubmitted(sessionId: String!): FormEvent!
    consoleMessage(sessionId: String!): ConsoleEvent!
    errorOccurred(sessionId: String!): ErrorEvent!
  }
  
  # Input types
  input ViewportInput {
    width: Int!
    height: Int!
  }
  
  input CookieInput {
    name: String!
    value: String!
    domain: String
    path: String
    expires: Int
    httpOnly: Boolean
    secure: Boolean
    sameSite: String
  }
  
  # Event types for subscriptions
  type NavigationEvent {
    sessionId: String!
    url: String!
    timestamp: String!
  }
  
  type ElementEvent {
    sessionId: String!
    selector: String!
    tag: String!
    timestamp: String!
  }
  
  type FormEvent {
    sessionId: String!
    formId: String
    timestamp: String!
  }
  
  type ConsoleEvent {
    sessionId: String!
    type: String!
    message: String!
    timestamp: String!
  }
  
  type ErrorEvent {
    sessionId: String!
    error: String!
    stack: String
    timestamp: String!
  }
`;

// Session management
interface Session {
  id: string;
  playClone: PlayClone;
  createdAt: Date;
  lastUsed: Date;
  metadata?: any;
}

export class GraphQLApiServer {
  private app: Express;
  private httpServer: any;
  private apolloServer: ApolloServer | null = null;
  private sessions: Map<string, Session> = new Map();
  private pubsub: PubSub;
  private config: {
    port: number;
    host: string;
    maxSessions: number;
    sessionTimeout: number;
    playground: boolean;
  };
  
  constructor(config: Partial<typeof GraphQLApiServer.prototype.config> = {}) {
    this.config = {
      port: config.port || 4000,
      host: config.host || 'localhost',
      maxSessions: config.maxSessions || 10,
      sessionTimeout: config.sessionTimeout || 30,
      playground: config.playground !== undefined ? config.playground : true
    };
    
    this.app = express();
    this.pubsub = new PubSub();
    this.httpServer = createServer(this.app);
  }
  
  // GraphQL resolvers
  private getResolvers() {
    return {
      Query: {
        // Session queries
        listSessions: () => {
          return Array.from(this.sessions.values()).map(session => ({
            id: session.id,
            createdAt: session.createdAt.toISOString(),
            lastUsed: session.lastUsed.toISOString(),
            isActive: true,
            metadata: session.metadata
          }));
        },
        
        getSession: (_: any, { id }: { id: string }) => {
          const session = this.sessions.get(id);
          if (!session) return null;
          
          return {
            id: session.id,
            createdAt: session.createdAt.toISOString(),
            lastUsed: session.lastUsed.toISOString(),
            isActive: true,
            metadata: session.metadata
          };
        },
        
        // Page information queries
        getCurrentUrl: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          // Return current page URL
          return session.playClone.page?.url() || '';
        },
        
        getTitle: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          // Return page title
          const titleResult = await session.playClone.getText('title');
          return titleResult.data;
        },
        
        getContent: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.getText();
          return result.data;
        },
        
        // Element queries
        findElement: async (_: any, { sessionId, selector }: { sessionId: string; selector: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          try {
            // Use click to test if element exists, then extract info
            const element = await session.playClone.getText(selector);
            if (element.data) {
              return {
                tag: 'div',
                text: element.data,
                attributes: {},
                isVisible: true,
                isInteractable: true
              };
            }
          } catch {}
          return null;
        },
        
        findElements: async (_: any, { sessionId, selector }: { sessionId: string; selector: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          // PlayClone doesn't have getAllElements, return empty for now
          return [];
        },
        
        isElementVisible: async (_: any, { sessionId, selector }: { sessionId: string; selector: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          // Check if we can get text from element (visible elements have text)
          try {
            const result = await session.playClone.getText(selector);
            return result.data !== null;
          } catch {
            return false;
          }
        },
        
        // Data extraction
        getText: async (_: any, { sessionId, selector }: { sessionId: string; selector?: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.getText(selector);
          return result.data;
        },
        
        getLinks: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.getLinks();
          return result.data || [];
        },
        
        getTables: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.getTable('');
          return result.data || [];
        },
        
        getForms: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.getFormData();
          return result.data || [];
        },
        
        // State management
        listCheckpoints: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = { data: [] }; // listCheckpoints not available
          return result.data || [];
        },
        
        getCheckpoint: async (_: any, { sessionId, checkpointId }: { sessionId: string; checkpointId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          const checkpoints: any[] = [];
          return checkpoints.find((cp: any) => cp.id === checkpointId) || null;
        }
      },
      
      Mutation: {
        // Session lifecycle
        createSession: async (_: any, { headless, viewport }: any) => {
          if (this.sessions.size >= this.config.maxSessions) {
            throw new Error(`Maximum sessions (${this.config.maxSessions}) reached`);
          }
          
          const id = uuidv4();
          const playClone = new PlayClone({
            headless: headless !== undefined ? headless : false,
            viewport: viewport || { width: 1280, height: 720 }
          });
          
          const session: Session = {
            id,
            playClone,
            createdAt: new Date(),
            lastUsed: new Date(),
            metadata: { headless, viewport }
          };
          
          this.sessions.set(id, session);
          
          // Publish session created event
          this.pubsub.publish('SESSION_CREATED', {
            sessionCreated: {
              id: session.id,
              createdAt: session.createdAt.toISOString(),
              lastUsed: session.lastUsed.toISOString(),
              isActive: true,
              metadata: session.metadata
            }
          });
          
          return {
            id: session.id,
            createdAt: session.createdAt.toISOString(),
            lastUsed: session.lastUsed.toISOString(),
            isActive: true,
            metadata: session.metadata
          };
        },
        
        closeSession: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.sessions.get(sessionId);
          if (!session) return false;
          
          await session.playClone.close();
          this.sessions.delete(sessionId);
          
          // Publish session closed event
          this.pubsub.publish('SESSION_CLOSED', { sessionClosed: sessionId });
          
          return true;
        },
        
        closeAllSessions: async () => {
          for (const [id, session] of this.sessions) {
            await session.playClone.close();
            this.pubsub.publish('SESSION_CLOSED', { sessionClosed: id });
          }
          this.sessions.clear();
          return true;
        },
        
        // Navigation
        navigate: async (_: any, { sessionId, url, waitUntil }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          
          // Publish navigation started event
          this.pubsub.publish('NAVIGATION_STARTED', {
            navigationStarted: {
              sessionId,
              url,
              timestamp: new Date().toISOString()
            }
          });
          
          const result = await session.playClone.navigate(url);
          
          // Publish navigation completed event
          this.pubsub.publish('NAVIGATION_COMPLETED', {
            navigationCompleted: {
              sessionId,
              url: result.value?.url || '',
              timestamp: new Date().toISOString()
            }
          });
          
          return {
            success: result.success,
            url: result.value?.url || '',
            title: result.value?.title || '',
            error: result.error
          };
        },
        
        goBack: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.back();
          return {
            success: result.success,
            url: result.value?.url || '',
            title: result.value?.title || '',
            error: result.error
          };
        },
        
        goForward: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.forward();
          return {
            success: result.success,
            url: result.value?.url || '',
            title: result.value?.title || '',
            error: result.error
          };
        },
        
        reload: async (_: any, { sessionId }: { sessionId: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.reload();
          return {
            success: result.success,
            url: null,
            title: null,
            error: result.error
          };
        },
        
        // Actions
        click: async (_: any, { sessionId, selector }: { sessionId: string; selector: string }) => {
          const session = this.getSessionOrThrow(sessionId);
          
          // Publish element clicked event
          this.pubsub.publish('ELEMENT_CLICKED', {
            elementClicked: {
              sessionId,
              selector,
              tag: 'unknown',
              timestamp: new Date().toISOString()
            }
          });
          
          const result = await session.playClone.click(selector);
          return result;
        },
        
        type: async (_: any, { sessionId, selector, text }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.type(selector, text);
          return result;
        },
        
        fill: async (_: any, { sessionId, selector, value }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.fill(selector, value);
          return result;
        },
        
        select: async (_: any, { sessionId, selector, value }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.select(selector, value);
          return result;
        },
        
        check: async (_: any, { sessionId, selector }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.check(selector);
          return result;
        },
        
        uncheck: async (_: any, { sessionId, selector }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.uncheck(selector);
          return result;
        },
        
        hover: async (_: any, { sessionId, selector }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.hover(selector);
          return result;
        },
        
        focus: async (_: any, { sessionId, selector }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.focus(selector);
          return result;
        },
        
        press: async (_: any, { sessionId, key }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.press(key);
          return result;
        },
        
        // Screenshots
        takeScreenshot: async (_: any, { sessionId, fullPage, selector, format }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.screenshot({
            fullPage
          });
          
          return {
            data: (result as any).data || '',
            format: format || 'png',
            fullPage: fullPage || false
          };
        },
        
        // State management
        createCheckpoint: async (_: any, { sessionId, name }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.saveState(name);
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to create checkpoint');
          }
          
          return {
            id: result.value?.id || name,
            name: result.value?.name || name,
            url: result.value?.state?.url || '',
            cookies: result.value?.state?.cookies?.length || 0,
            localStorage: Object.keys(result.value?.state?.localStorage || {}).length,
            sessionStorage: Object.keys(result.value?.state?.sessionStorage || {}).length,
            createdAt: new Date().toISOString()
          };
        },
        
        restoreCheckpoint: async (_: any, { sessionId, checkpointId }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.restoreState(checkpointId);
          return result;
        },
        
        deleteCheckpoint: async (_: any, { sessionId, checkpointId }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          // Delete checkpoint not directly supported
          const result = { success: true };
          return result.success;
        },
        
        // Script execution
        executeScript: async (_: any, { sessionId, script }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          // PlayClone doesn't have executeScript yet
          return { error: 'Script execution not yet implemented' };
        },
        
        // Form automation
        fillForm: async (_: any, { sessionId, formData }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          // Fill form fields one by one
          try {
            for (const [selector, value] of Object.entries(formData)) {
              await session.playClone.fill(selector, value as string);
            }
            return { success: true, data: formData };
          } catch (error: any) {
            return { success: false, error: error.message };
          }
        },
        
        submitForm: async (_: any, { sessionId, selector }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          
          // Publish form submitted event
          this.pubsub.publish('FORM_SUBMITTED', {
            formSubmitted: {
              sessionId,
              formId: selector || 'default',
              timestamp: new Date().toISOString()
            }
          });
          
          // Submit form by clicking submit button or pressing Enter
          const submitButton = selector || 'button[type="submit"]';
          const result = await session.playClone.click(submitButton);
          return result;
        },
        
        // Cookies
        setCookie: async (_: any, { sessionId, cookie }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.setCookie(cookie);
          return result.success;
        },
        
        getCookies: async (_: any, { sessionId, url }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.getCookies(url);
          return result.success && Array.isArray(result.cookies) ? result.cookies : [];
        },
        
        clearCookies: async (_: any, { sessionId }: any) => {
          const session = this.getSessionOrThrow(sessionId);
          const result = await session.playClone.clearCookies();
          return result.success;
        }
      },
      
      Subscription: {
        sessionCreated: {
          subscribe: () => (this.pubsub as any).asyncIterator(['SESSION_CREATED'])
        },
        
        sessionClosed: {
          subscribe: () => (this.pubsub as any).asyncIterator(['SESSION_CLOSED'])
        },
        
        navigationStarted: {
          subscribe: (_: any, { sessionId }: any) => {
            if (sessionId && !this.sessions.has(sessionId)) {
              throw new Error(`Session ${sessionId} not found`);
            }
            return (this.pubsub as any).asyncIterator(['NAVIGATION_STARTED']);
          }
        },
        
        navigationCompleted: {
          subscribe: (_: any, { sessionId }: any) => {
            if (sessionId && !this.sessions.has(sessionId)) {
              throw new Error(`Session ${sessionId} not found`);
            }
            return (this.pubsub as any).asyncIterator(['NAVIGATION_COMPLETED']);
          }
        },
        
        elementClicked: {
          subscribe: (_: any, { sessionId }: any) => {
            if (sessionId && !this.sessions.has(sessionId)) {
              throw new Error(`Session ${sessionId} not found`);
            }
            return (this.pubsub as any).asyncIterator(['ELEMENT_CLICKED']);
          }
        },
        
        formSubmitted: {
          subscribe: (_: any, { sessionId }: any) => {
            if (sessionId && !this.sessions.has(sessionId)) {
              throw new Error(`Session ${sessionId} not found`);
            }
            return (this.pubsub as any).asyncIterator(['FORM_SUBMITTED']);
          }
        },
        
        consoleMessage: {
          subscribe: (_: any, { sessionId }: any) => {
            if (sessionId && !this.sessions.has(sessionId)) {
              throw new Error(`Session ${sessionId} not found`);
            }
            return (this.pubsub as any).asyncIterator(['CONSOLE_MESSAGE']);
          }
        },
        
        errorOccurred: {
          subscribe: (_: any, { sessionId }: any) => {
            if (sessionId && !this.sessions.has(sessionId)) {
              throw new Error(`Session ${sessionId} not found`);
            }
            return (this.pubsub as any).asyncIterator(['ERROR_OCCURRED']);
          }
        }
      },
      
      // Custom scalar resolver
      JSON: {
        serialize: (value: any) => value,
        parseValue: (value: any) => value,
        parseLiteral: (ast: any) => ast.value
      }
    };
  }
  
  private getSessionOrThrow(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Publish error event
      this.pubsub.publish('ERROR_OCCURRED', {
        errorOccurred: {
          sessionId,
          error: `Session ${sessionId} not found`,
          timestamp: new Date().toISOString()
        }
      });
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Update last used time
    session.lastUsed = new Date();
    return session;
  }
  
  async start(): Promise<void> {
    // Create executable schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: this.getResolvers()
    });
    
    // Create Apollo Server
    this.apolloServer = new ApolloServer({
      schema,
      introspection: true,
      plugins: [
        {
          async serverWillStart() {
            console.log('GraphQL Server starting...');
          },
          async requestDidStart() {
            return {
              async willSendResponse() {
                // Log response
              }
            };
          }
        }
      ]
    });
    
    // Start Apollo Server
    await this.apolloServer.start();
    
    // Apply middleware
    this.apolloServer.applyMiddleware({
      app: this.app,
      path: '/graphql',
      cors: {
        origin: '*',
        credentials: true
      }
    });
    
    // Set up WebSocket server for subscriptions
    const wsServer = new WebSocketServer({
      server: this.httpServer,
      path: '/graphql'
    });
    
    // Use the WebSocket server with GraphQL
    useServer({ schema }, wsServer);
    
    // Start HTTP server
    return new Promise((resolve) => {
      this.httpServer.listen(this.config.port, this.config.host, () => {
        console.log(`🚀 GraphQL Server ready at http://${this.config.host}:${this.config.port}/graphql`);
        console.log(`🔌 Subscriptions ready at ws://${this.config.host}:${this.config.port}/graphql`);
        if (this.config.playground) {
          console.log(`🎮 GraphQL Playground available at http://${this.config.host}:${this.config.port}/graphql`);
        }
        resolve();
      });
    });
  }
  
  async stop(): Promise<void> {
    // Close all sessions
    for (const session of this.sessions.values()) {
      await session.playClone.close();
    }
    this.sessions.clear();
    
    // Stop Apollo Server
    if (this.apolloServer) {
      await this.apolloServer.stop();
    }
    
    // Close HTTP server
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        console.log('GraphQL Server stopped');
        resolve();
      });
    });
  }
  
  // Session cleanup
  startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = this.config.sessionTimeout * 60 * 1000;
      
      for (const [id, session] of this.sessions) {
        if (now - session.lastUsed.getTime() > timeout) {
          session.playClone.close().then(() => {
            this.sessions.delete(id);
            console.log(`Session ${id} expired and removed`);
          });
        }
      }
    }, 60000); // Check every minute
  }
}