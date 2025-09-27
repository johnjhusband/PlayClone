#!/usr/bin/env node
/**
 * Runner for PlayClone Self-Test
 * This runs the TypeScript self-test directly using ts-node
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting PlayClone Self-Test...\n');

// Run the TypeScript file directly with ts-node
const tsNodePath = path.join(__dirname, 'node_modules', '.bin', 'ts-node');
const testFile = path.join(__dirname, 'examples', 'playclone-self-test.ts');

const child = spawn(tsNodePath, [testFile], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test' }
});

child.on('error', (err) => {
  console.error('Failed to start self-test:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});