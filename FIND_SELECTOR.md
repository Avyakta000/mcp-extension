# Find ChatGPT Selector - Helper Script

If the MCP button isn't appearing inline, use this script to find the correct selector.

## 🔍 Step 1: Find the Right Element

On ChatGPT page, open console (F12) and paste this:

```javascript
// Find the input area and its parent structure
const textarea = document.querySelector('#prompt-textarea') ||
                 document.querySelector('textarea') ||
                 document.querySelector('[contenteditable="true"]');

if (textarea) {
    console.log('✅ Found textarea:', textarea);

    // Highlight it
    textarea.style.border = '3px solid red';

    // Find the form
    const form = textarea.closest('form');
    console.log('📝 Form:', form);

    // Find all buttons in the form
    const buttons = form.querySelectorAll('button');
    console.log('🔘 Buttons in form:', buttons.length);
    buttons.forEach((btn, i) => {
        console.log(`  Button ${i}:`, btn.getAttribute('aria-label'), btn);
        btn.style.border = '2px solid blue';
    });

    // Find potential insertion points
    console.log('\n🎯 Potential insertion points:');

    // Try to find the attachment button area
    const attachBtn = form.querySelector('button[aria-label*="Attach"]') ||
                     form.querySelector('button[aria-label*="attach"]');
    if (attachBtn) {
        console.log('📎 Found attach button:', attachBtn);
        const parent = attachBtn.parentElement;
        console.log('  Parent element:', parent);
        parent.style.border = '3px solid green';
        console.log('  ✅ Use this selector:', getCssSelector(parent));
    }

    // Try to find button container
    const btnContainer = form.querySelector('.flex.items-center') ||
                        form.querySelector('div[class*="flex"]');
    if (btnContainer && btnContainer.querySelector('button')) {
        console.log('🔧 Found button container:', btnContainer);
        btnContainer.style.border = '3px solid orange';
        console.log('  ✅ Use this selector:', getCssSelector(btnContainer));
    }
} else {
    console.error('❌ Could not find textarea');
}

// Helper to get CSS selector
function getCssSelector(el) {
    if (el.id) return '#' + el.id;

    let path = [];
    while (el.parentElement) {
        let selector = el.tagName.toLowerCase();
        if (el.className) {
            selector += '.' + Array.from(el.classList).join('.');
        }
        path.unshift(selector);
        el = el.parentElement;
        if (path.length > 3) break; // Keep it short
    }
    return path.join(' > ');
}
```

## 📊 Step 2: Analyze Output

Look at the console output. You'll see elements highlighted in colors:
- **Red border** = Text input
- **Blue borders** = All buttons in form
- **Green border** = Attach button parent (best insertion point)
- **Orange border** = Button container (alternative)

## ✅ Step 3: Copy the Selector

Look for lines like:
```
✅ Use this selector: div.flex.items-center > div
```

Copy that selector!

## 🛠️ Step 4: Test the Selector

Paste this (replace `YOUR_SELECTOR` with the selector from above):

```javascript
const insertionPoint = document.querySelector('YOUR_SELECTOR');
console.log('Found insertion point:', insertionPoint);

// Test creating a button there
const testBtn = document.createElement('button');
testBtn.textContent = '🔧 TEST';
testBtn.style.cssText = 'padding: 8px; margin: 0 4px; border-radius: 8px; background: purple; color: white; border: none;';
insertionPoint.insertBefore(testBtn, insertionPoint.firstChild);

console.log('✅ Test button created! If you see it near the input, the selector works!');
```

If you see a purple "🔧 TEST" button near the input → **selector works!**

## 📝 Step 5: Update the Code

Tell me the selector that worked, and I'll update the code with it!

---

## 🚀 Quick Alternative: Use Fallback Button

The **floating button** (purple circle in bottom-right) should already work!

Just use that for now while we fix the inline placement. The floating button has all the same functionality.

---

## 💡 Most Common Selectors (Try These First)

Try these in console one by one:

```javascript
// Option 1: Form's first div
document.querySelector('form > div')

// Option 2: Textarea parent's parent
document.querySelector('#prompt-textarea')?.parentElement?.parentElement

// Option 3: Any div with buttons
document.querySelector('form div:has(button)')

// Option 4: Last div in form
const form = document.querySelector('form');
form?.querySelector('div:last-child')
```

One of these will likely return an element. Tell me which one works!
