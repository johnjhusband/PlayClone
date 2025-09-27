/**
 * Simple logger utility for PlayClone
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private context: string;
  private static level: LogLevel = LogLevel.INFO;
  private static instance: Logger;

  constructor(context: string = 'PlayClone') {
    this.context = context;
  }

  static getInstance(context: string = 'PlayClone'): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context);
    }
    return Logger.instance;
  }

  static setLevel(level: LogLevel): void {
    Logger.level = level;
  }

  debug(...args: any[]): void {
    if (Logger.level <= LogLevel.DEBUG) {
      console.debug(`[${this.context}]`, ...args);
    }
  }

  info(...args: any[]): void {
    if (Logger.level <= LogLevel.INFO) {
      console.log(`[${this.context}]`, ...args);
    }
  }

  warn(...args: any[]): void {
    if (Logger.level <= LogLevel.WARN) {
      console.warn(`[${this.context}]`, ...args);
    }
  }

  error(...args: any[]): void {
    if (Logger.level <= LogLevel.ERROR) {
      console.error(`[${this.context}]`, ...args);
    }
  }
}