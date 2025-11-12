/**
 * Watch for changes and notify to reload extension
 * This creates a simple file that the extension can watch
 */

const fs = require('fs');
const path = require('path');

const reloadFile = path.join(__dirname, '../dist/reload.json');

function notifyReload() {
  const timestamp = Date.now();
  fs.writeFileSync(reloadFile, JSON.stringify({ timestamp }));
  console.log(`\n🔄 Files rebuilt! Reload timestamp: ${timestamp}`);
  console.log('👉 Go to chrome://extensions/ and click reload, or use Extensions Reloader\n');
}

// Watch dist directory for changes
const distDir = path.join(__dirname, '../dist');
let debounceTimer;

fs.watch(distDir, { recursive: true }, (eventType, filename) => {
  if (filename && !filename.includes('reload.json')) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(notifyReload, 500);
  }
});

console.log('👀 Watching for changes...\n');
