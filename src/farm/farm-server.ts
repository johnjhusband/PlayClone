#!/usr/bin/env node

/**
 * PlayClone Browser Farm Server
 * 
 * This is the main entry point for running PlayClone as a distributed browser farm.
 * It can run in two modes:
 * - Farm mode: Manages and coordinates browser workers
 * - Worker mode: Runs browser instances for the farm
 */

import { BrowserFarm } from './BrowserFarm';
import { Logger, LogLevel } from '../utils/Logger';
import * as process from 'process';

// Configuration from environment variables
const config = {
  mode: process.env.WORKER_MODE === 'true' ? 'worker' : 'farm',
  port: parseInt(process.env.PLAYCLONE_PORT || '8080'),
  workerPort: parseInt(process.env.WORKER_PORT || '8081'),
  maxSessionsPerWorker: parseInt(process.env.PLAYCLONE_MAX_SESSIONS_PER_WORKER || '10'),
  healthCheckInterval: parseInt(process.env.PLAYCLONE_HEALTH_CHECK_INTERVAL || '30000'),
  sessionTimeout: parseInt(process.env.PLAYCLONE_SESSION_TIMEOUT || '300000'),
  loadBalancingStrategy: process.env.PLAYCLONE_LOAD_BALANCING_STRATEGY || 'least-connections',
  authType: process.env.PLAYCLONE_AUTH_TYPE || 'none',
  authSecret: process.env.PLAYCLONE_AUTH_SECRET,
  logLevel: process.env.PLAYCLONE_LOG_LEVEL || 'info',
  workers: process.env.PLAYCLONE_WORKERS ? JSON.parse(process.env.PLAYCLONE_WORKERS) : []
};

// Set log level
switch (config.logLevel.toLowerCase()) {
  case 'debug':
    Logger.setLevel(LogLevel.DEBUG);
    break;
  case 'info':
    Logger.setLevel(LogLevel.INFO);
    break;
  case 'warn':
    Logger.setLevel(LogLevel.WARN);
    break;
  case 'error':
    Logger.setLevel(LogLevel.ERROR);
    break;
}

const logger = new Logger('FarmServer');

/**
 * Start the farm server
 */
async function startFarmServer(): Promise<void> {
  logger.info('Starting PlayClone Browser Farm Server...');
  logger.info(`Mode: ${config.mode}`);
  logger.info(`Port: ${config.port}`);
  
  const farm = new BrowserFarm({
    port: config.port,
    maxSessionsPerWorker: config.maxSessionsPerWorker,
    healthCheckInterval: config.healthCheckInterval,
    sessionTimeout: config.sessionTimeout,
    loadBalancingStrategy: config.loadBalancingStrategy as any,
    authentication: {
      type: config.authType as any,
      secret: config.authSecret
    },
    workers: config.workers
  });
  
  // Handle shutdown gracefully
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await farm.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await farm.stop();
    process.exit(0);
  });
  
  // Handle errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection:', reason);
    process.exit(1);
  });
  
  // Start the farm
  await farm.start();
  
  // In Kubernetes, automatically discover other workers
  if (process.env.KUBERNETES_SERVICE_HOST) {
    await discoverKubernetesWorkers(farm);
  }
  
  logger.info('Browser farm server started successfully');
}

/**
 * Start a worker node
 */
async function startWorkerNode(): Promise<void> {
  logger.info('Starting PlayClone Worker Node...');
  logger.info(`Worker Port: ${config.workerPort}`);
  
  // TODO: Implement worker node that responds to farm requests
  // This would be a simplified version that just manages local browser instances
  
  logger.info('Worker node started successfully');
}

/**
 * Discover workers in Kubernetes
 */
async function discoverKubernetesWorkers(farm: BrowserFarm): Promise<void> {
  logger.info('Discovering Kubernetes workers...');
  
  // In a real implementation, this would use the Kubernetes API
  // to discover other worker pods in the same namespace
  
  // For now, use DNS-based discovery for StatefulSet
  const workerService = process.env.WORKER_SERVICE || 'playclone-worker';
  const namespace = process.env.NAMESPACE || 'playclone';
  const workerCount = parseInt(process.env.WORKER_COUNT || '5');
  
  for (let i = 0; i < workerCount; i++) {
    const workerHost = `${workerService}-${i}.${workerService}.${namespace}.svc.cluster.local`;
    
    try {
      await farm.addWorker({
        host: workerHost,
        port: config.workerPort,
        capacity: config.maxSessionsPerWorker
      });
      
      logger.info(`Added Kubernetes worker: ${workerHost}`);
    } catch (error) {
      logger.warn(`Failed to add worker ${workerHost}:`, error);
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('PlayClone Browser Farm');
  logger.info('========================');
  
  if (config.mode === 'worker') {
    await startWorkerNode();
  } else {
    await startFarmServer();
  }
}

// Start the application
main().catch((error) => {
  logger.error('Failed to start:', error);
  process.exit(1);
});