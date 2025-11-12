/**
 * Debug script to find the correct insertion point for MCP button
 * Run this in ChatGPT console (F12)
 */

console.log('🔍 Searching for button insertion point...\n');

// List of selectors to try
const selectors = [
  'form div.flex.gap-2',
  'form div[class*="gap"]',
  'form button[aria-label*="Voice"]',
  'form button[aria-label*="Microphone"]',
  'form div:has(> button[aria-label*="Voice"])',
  'form div:has(> button[aria-label*="mic"])',
  'form > div > div:last-child',
  'form div.flex:last-child',
];

let found = null;

for (const selector of selectors) {
  const element = document.querySelector(selector);
  if (element) {
    console.log(`✅ Found with selector: "${selector}"`);
    console.log('   Element:', element);
    console.log('   Parent:', element.parentElement);

    // Highlight it
    const originalBorder = element.style.border;
    element.style.border = '3px solid lime';

    setTimeout(() => {
      element.style.border = originalBorder;
    }, 3000);

    if (!found) found = { selector, element };
  } else {
    console.log(`❌ Not found: "${selector}"`);
  }
}

if (found) {
  console.log('\n🎯 Best insertion point found!');
  console.log('Selector:', found.selector);
  console.log('Element:', found.element);

  // Test create button
  const testBtn = document.createElement('button');
  testBtn.textContent = '🔧';
  testBtn.style.cssText = `
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgb(139, 92, 246);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  `;

  found.element.insertBefore(testBtn, found.element.firstChild);
  console.log('\n✨ Test button created! Look for purple 🔧 button on the right side');

  // Remove after 5 seconds
  setTimeout(() => {
    testBtn.remove();
    console.log('Test button removed');
  }, 5000);
} else {
  console.log('\n❌ No insertion point found. Trying alternative search...');

  // Show form structure
  const form = document.querySelector('form');
  if (form) {
    console.log('\n📋 Form structure:');
    console.log(form);

    // Find all button containers
    const buttonContainers = form.querySelectorAll('div:has(> button)');
    console.log(`\n🔘 Found ${buttonContainers.length} button containers:`);
    buttonContainers.forEach((container, i) => {
      console.log(`  ${i + 1}.`, container);
      const buttons = container.querySelectorAll('button');
      console.log(`     Contains ${buttons.length} button(s)`);
      buttons.forEach(btn => {
        console.log(`       - ${btn.getAttribute('aria-label') || 'No label'}`);
      });
    });
  }
}
