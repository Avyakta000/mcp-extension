# Development Workflow Guide

## 🚀 Quick Start Development

### Option 1: Manual Reload (Simplest)

**Terminal 1: Watch and rebuild**
```bash
cd chatgpt-mcp-extension
npm run dev
```

**When you make changes:**
1. ✅ Files auto-rebuild (webpack watch)
2. ⚠️ Go to `chrome://extensions/`
3. ⚠️ Click reload button under your extension
4. ⚠️ Refresh ChatGPT page (F5)

**Pros:** Simple, no extra tools
**Cons:** Manual reload every time

---

### Option 2: Extensions Reloader (Recommended)

**One-time setup:**
1. Install [Extensions Reloader](https://chromewebstore.google.com/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid)
2. Click the Extensions Reloader icon
3. Check your extension in the list

**Development:**
```bash
# Terminal: Watch and rebuild
npm run dev
```

**When you make changes:**
1. ✅ Files auto-rebuild
2. ✅ Click Extensions Reloader icon (one click!)
3. ⚠️ Refresh ChatGPT page

**Pros:** One-click reload
**Cons:** Need browser extension

---

### Option 3: Keyboard Shortcut (Power Users)

**Setup keyboard shortcut:**
1. Go to `chrome://extensions/shortcuts`
2. Find "Extensions Reloader"
3. Set shortcut: `Ctrl+Shift+R` (or your preference)

**Development:**
```bash
npm run dev
```

**When you make changes:**
1. ✅ Files auto-rebuild
2. ✅ Press `Ctrl+Shift+R` (reload extension)
3. ⚠️ Refresh ChatGPT page

**Pros:** Super fast, keyboard-driven
**Cons:** Need Extensions Reloader

---

### Option 4: Watch Notifications (Visual Feedback)

**Terminal 1: Webpack watch**
```bash
npm run dev
```

**Terminal 2: Watch notifier**
```bash
npm run dev:notify
```

**What you see:**
```
👀 Watching for changes...

🔄 Files rebuilt! Reload timestamp: 1234567890
👉 Go to chrome://extensions/ and click reload
```

**Pros:** Visual confirmation of rebuilds
**Cons:** Still manual reload

---

## 📂 What Auto-Reloads vs. What Doesn't

### Auto-Reloads ✅
- **TypeScript files** → JavaScript (webpack watch)
- **Import changes** → Re-bundled (webpack watch)
- **New files** → Included in bundle (webpack watch)

### Needs Extension Reload ⚠️
- **Background service worker** (`src/background/*`)
- **Popup** (`src/popup/*`)
- **Manifest.json** changes
- **Icons** or static assets
- **MCP client** changes (`src/mcp/*`)

### Sometimes Auto-Reloads 🤷
- **Content script** (`src/content/*`)
  - ✅ If you just refresh ChatGPT page
  - ⚠️ If you changed event listeners or initialization

---

## 🔥 Recommended Workflow

### For Most Developers

1. **Install Extensions Reloader** (one-time)
2. **Set keyboard shortcut** `Ctrl+Shift+R`
3. **Run watch mode:**
   ```bash
   npm run dev
   ```
4. **Edit code** → Save
5. **Press** `Ctrl+Shift+R` (reload extension)
6. **Refresh** ChatGPT tab
7. **Test**

### For Advanced Developers

Consider using:
- **Concurrently** to run multiple commands
- **Nodemon** to watch and restart
- **Browser DevTools** for debugging

---

## 🐛 Development Tips

### 1. Keep DevTools Open

**Background Service Worker:**
```
chrome://extensions/ → Service worker → Inspect
```
Console shows:
```
[MCP Client] Connecting via websocket...
[MCP Client] Connected successfully
[MCP Client] Found 5 tools
```

**Content Script:**
```
ChatGPT page → F12 → Console
```
Console shows:
```
[MCP Extension] Initializing...
[MCP Extension] ChatGPT interface ready
```

**Popup:**
```
Right-click extension icon → Inspect popup
```

---

### 2. Use Console Logging

Already added in code:
```typescript
console.log('[MCP Client] Connecting...');
console.log('[MCP Extension] Tool detected:', toolName);
console.error('[Background] Error:', error);
```

Prefix with component name for easy filtering.

---

### 3. Test Incrementally

**Don't change everything at once!**

Good workflow:
1. Change one file
2. Reload extension
3. Test specific feature
4. Verify it works
5. Move to next change

---

### 4. Check Build Output

Watch webpack output:
```
webpack 5.102.1 compiled successfully in 2758 ms
```

If you see errors:
```
ERROR in ./src/mcp/client.ts
TS2322: Type 'X' is not assignable to type 'Y'
```

Fix immediately before testing!

---

### 5. Clear Cache Sometimes

If weird issues:
```
chrome://extensions/ → Remove extension → Re-add
```

Or:
```
chrome://extensions/ → Details → Clear storage and cache
```

---

## ⚡ Performance Tips

### Fast Rebuild

Current build time: ~3 seconds

To speed up:
1. Use `--mode development` (no minification)
2. Disable source maps (already done)
3. Use cache (webpack automatic)

### Selective Testing

**Only testing content script?**
- Just refresh ChatGPT page
- Don't reload extension

**Only testing background?**
- Reload extension
- Don't refresh ChatGPT

**Testing popup?**
- Close and reopen popup
- Or reload extension

---

## 🎯 Common Development Scenarios

### Scenario 1: Adding New Tool Detection

**Files to change:**
- `src/content/tool-parser.ts`

**Workflow:**
1. Edit parser logic
2. `npm run dev` (if not running)
3. Reload extension (`Ctrl+Shift+R`)
4. Refresh ChatGPT page
5. Test with tool call

**Expected time:** 30 seconds

---

### Scenario 2: Modifying MCP Client

**Files to change:**
- `src/mcp/client.ts`

**Workflow:**
1. Edit client code
2. Wait for rebuild (~3s)
3. Reload extension
4. Check background console
5. Test connection

**Expected time:** 20 seconds

---

### Scenario 3: UI Changes

**Files to change:**
- `src/popup/popup.html`
- `src/popup/index.ts`

**Workflow:**
1. Edit UI code
2. Wait for rebuild
3. Reload extension
4. Open popup
5. Test changes

**Expected time:** 15 seconds

---

### Scenario 4: Manifest Changes

**Files to change:**
- `manifest.json`

**Workflow:**
1. Edit manifest
2. Rebuild: `npm run build`
3. **Fully reload extension** (remove & re-add)
4. Test

**Expected time:** 30 seconds

---

## 🚨 Troubleshooting

### Extension Not Updating

**Problem:** Made changes but nothing happens

**Solutions:**
1. Check webpack compiled successfully
2. Reload extension (not just refresh page)
3. Hard refresh ChatGPT (`Ctrl+Shift+R`)
4. Clear browser cache
5. Check you're editing the right file

---

### Service Worker Crashed

**Problem:** Background service worker shows "Inactive (crashed)"

**Solutions:**
1. Check background console for errors
2. Click "Service worker" to restart
3. Reload extension
4. Check for infinite loops or errors

---

### Changes Not Appearing

**Problem:** Edited code but old version runs

**Solutions:**
1. Verify `dist/` folder updated (check file timestamp)
2. Completely reload extension
3. Check webpack is watching (`npm run dev`)
4. Rebuild: `npm run build`

---

## 📊 Development Checklist

Before testing:
- [ ] `npm run dev` is running
- [ ] Webpack compiled successfully
- [ ] Extension reloaded
- [ ] ChatGPT page refreshed (if testing content script)
- [ ] Console open (F12)
- [ ] Checking correct console (background/content/popup)

---

## 🎓 Pro Tips

1. **Use Split Screen**
   - Left: VS Code
   - Right: Chrome with DevTools

2. **Keep Logs Open**
   - Background worker console
   - ChatGPT page console
   - Always visible

3. **Use Breakpoints**
   - Chrome DevTools → Sources
   - Set breakpoints in `dist/` files
   - Step through execution

4. **Test Edge Cases**
   - Disconnect/reconnect
   - Tool errors
   - Network failures
   - Long tool execution

5. **Version Control**
   - Commit working code
   - Branch for experiments
   - Easy rollback if broken

---

## 🔗 Useful Links

- [Chrome Extension DevTools](https://developer.chrome.com/docs/extensions/mv3/devtools/)
- [Extensions Reloader](https://chromewebstore.google.com/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid)
- [Webpack Watch Mode](https://webpack.js.org/configuration/watch/)
- [Chrome Extension Debugging](https://developer.chrome.com/docs/extensions/mv3/tut_debugging/)

---

## ✨ Summary

**Fastest Workflow:**
```bash
# Setup (once)
1. Install Extensions Reloader
2. Set keyboard shortcut: Ctrl+Shift+R

# Development (every time)
1. npm run dev
2. Edit code
3. Ctrl+Shift+R (reload extension)
4. F5 on ChatGPT (if testing content script)
5. Test!
```

**Typical iteration time: 10-15 seconds**

---

Happy coding! 🚀
