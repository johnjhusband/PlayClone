/**
 * Core type definitions for PlayClone
 */

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export interface LaunchOptions {
  headless?: boolean;
  viewport?: Viewport;
  userAgent?: string;
  timeout?: number;
  browser?: BrowserType;
  args?: string[];
  executablePath?: string;
  slowMo?: number;
  devtools?: boolean;
}

export interface ElementSelector {
  text?: string;
  role?: string;
  label?: string;
  placeholder?: string;
  id?: string;
  class?: string;
  name?: string;
  title?: string;
  alt?: string;
  xpath?: string;
  css?: string;
  index?: number;
  ariaLabel?: string;
  selector?: string;
  normalized?: string;
}

export interface ActionResult {
  success: boolean;
  action: string;
  target?: string;
  value?: any;
  error?: string;
  errorCode?: string;
  suggestion?: string;
  retryable?: boolean;
  selector?: string;
  url?: string;
  duration?: number;
  timestamp: number;
}

export interface ExtractedData {
  type: string;
  data: any;
  metadata?: {
    url?: string;
    title?: string;
    timestamp: number;
    extractionTime?: number;
  };
}

export interface PageState {
  url: string;
  title: string;
  cookies: any[];
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  viewport?: Viewport;
  timestamp: number;
  scrollPosition?: { x: number; y: number };
  viewportSize?: { width: number; height: number };
}

export interface SessionData {
  id: string;
  created: number;
  updated: number;
  state: PageState;
  history: string[];
  metadata?: Record<string, any>;
}

export interface AIResponse {
  result: any;
  tokens?: number;
  size?: number;
  compressed?: boolean;
  reduction?: number;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  suggestion?: string;
  recoverable: boolean;
}