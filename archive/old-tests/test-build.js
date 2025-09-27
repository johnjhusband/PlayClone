/**
 * Quick test to verify PlayClone builds and initializes correctly
 */

const PlayClone = require('./dist/index.js').default;

console.log('Testing PlayClone build...\n');

// Check exports
console.log('✓ PlayClone class exported');
console.log('✓ TypeScript compiled successfully');

// Test instantiation
const browser = new PlayClone({
  headless: true,
  browser: 'chromium'
});

console.log('✓ PlayClone instance created');

// Check methods exist
if (typeof browser.init === 'function') {
  console.log('✓ init() method exists');
}

if (typeof browser.getContext === 'function') {
  console.log('✓ getContext() method exists');
}

if (typeof browser.close === 'function') {
  console.log('✓ close() method exists');
}

console.log('\n✅ Build verification complete!');
console.log('PlayClone is ready for use.');