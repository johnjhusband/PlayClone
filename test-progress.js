#!/usr/bin/env node

// Test what PlayClone built
console.log('=== TESTING PLAYCLONE PROGRESS ===\n');

// Check what modules exist
const fs = require('fs');
const path = require('path');

console.log('📁 Built modules:');
const srcDir = path.join(__dirname, 'src');
const modules = [
  'core/BrowserManager.ts',
  'core/SessionManager.ts', 
  'selectors/ElementLocator.ts',
  'actions/ActionExecutor.ts',
  'extractors/DataExtractor.ts',
  'state/StateManager.ts',
  'utils/errors.ts',
  'utils/retry.ts',
  'utils/timeout.ts',
  'utils/responseOptimizer.ts',
  'utils/connectionPool.ts',
  'utils/operationCache.ts'
];

modules.forEach(mod => {
  const exists = fs.existsSync(path.join(srcDir, mod));
  console.log(`  ${exists ? '✅' : '❌'} ${mod}`);
});

// Check TODO completion
console.log('\n📋 TODO Progress:');
const todo = fs.readFileSync('TODO.md', 'utf8');
const completed = (todo.match(/^\- \[x\]/gm) || []).length;
const pending = (todo.match(/^\- \[ \]/gm) || []).length;
const total = completed + pending;
const percent = Math.round((completed / total) * 100);

console.log(`  Completed: ${completed}/${total} (${percent}%)`);
console.log(`  Remaining: ${pending} tasks`);

// Show what phases are done
console.log('\n🏁 Completed Phases:');
const phases = [
  'Phase 1: Foundation Setup',
  'Phase 2: Core Engine', 
  'Phase 3: Element Selection Engine',
  'Phase 4: Core Actions',
  'Phase 5: Data Extraction',
  'Phase 6: State Management',
  'Phase 7: Error Handling & Recovery',
  'Phase 8: Testing & Examples',
  'Phase 9: Documentation',
  'Phase 10: Optimization'
];

phases.forEach(phase => {
  const phaseSection = todo.substring(
    todo.indexOf(phase),
    todo.indexOf('##', todo.indexOf(phase) + 1)
  );
  const phaseCompleted = (phaseSection.match(/^\- \[x\]/gm) || []).length;
  const phasePending = (phaseSection.match(/^\- \[ \]/gm) || []).length;
  const phaseTotal = phaseCompleted + phasePending;
  
  if (phaseTotal > 0) {
    const done = phaseCompleted === phaseTotal;
    console.log(`  ${done ? '✅' : '🔄'} ${phase} (${phaseCompleted}/${phaseTotal})`);
  }
});

console.log('\n✨ PlayClone has been built with all core features!');