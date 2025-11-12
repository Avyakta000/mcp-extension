# Testing Guide - Complete Flow

This guide will help you test the complete MCP integration with ChatGPT.

## ✅ What's Been Fixed

1. **Enhanced MutationObserver** - Now watches for:
   - `childList`: New elements added
   - `characterData`: Text content changes (streaming)
   - Pattern detection for `<function_calls>` and `<invoke` tags

2. **Code Block Targeting** - Specifically scans:
   - `<pre>` tags
   - `<code>` tags
   - `<pre><code>` combinations (ChatGPT's format)

3. **Streaming Support** - Detects tool calls even as ChatGPT is typing

4. **Auto-execute** - Executes tools automatically when enabled

## 🚀 Complete Testing Steps

### Step 1: Reload Extension

1. Go to `chrome://extensions/`
2. Find "ChatGPT MCP Extension"
3. Click the reload icon (⟳)
4. Extension should reload successfully

### Step 2: Start MCP Proxy

```bash
cd C:\Users\ASUS\Desktop\agent
npx @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json
```

Expected output:
```
Server running at http://localhost:3006
SSE endpoint: http://localhost:3006/sse
WebSocket endpoint: ws://localhost:3006/message
```

### Step 3: Connect Extension to Proxy

1. Click the extension icon in Chrome toolbar
2. Select transport: **WebSocket** (or SSE/Streamable HTTP)
3. URL should be: `ws://localhost:3006/message` (for WebSocket)
4. Click "Connect"
5. Wait for "Connected" status
6. Should show "X tools available"

### Step 4: Open ChatGPT

1. Navigate to `https://chatgpt.com`
2. Start a new conversation
3. Look for the **purple MCP button** inline with voice/mic buttons
   - If not inline, look for floating button in bottom-right

### Step 5: Configure MCP Settings

Click the purple MCP button. Modal should show:

1. **Enable MCP Toggle**
   - Turn this **ON**
   - Sidebar should appear with available tools

2. **Auto-execute Toggle**
   - Turn this **ON** for automatic execution
   - Or **OFF** for manual execution

3. **Instructions** (optional)
   - Add: "Always show me the tool calls you're making"

### Step 6: Insert MCP Instructions

**CRITICAL STEP!**

1. In the modal, scroll down
2. Click **"Insert Instructions"** button
3. Large system prompt will be inserted into ChatGPT input
4. Click **Send** (or press Enter)
5. ChatGPT should acknowledge: "I understand. I'll use the available tools..."

### Step 7: Test Tool Call Detection

Now ask ChatGPT to use a tool:

**Example 1: List Directory**
```
List all files in /Users/ASUS/Desktop
```

**Expected Response from ChatGPT:**
````
I'll list the files in your Desktop directory.

```xml
<function_calls>
<invoke name="filesystem.list_directory" call_id="1">
<parameter name="path">/Users/ASUS/Desktop</parameter>
</invoke>
</function_calls>
```
````

**What Should Happen:**

1. ✅ **Console logs** (Open DevTools - F12):
   ```
   [MCP Extension] Tool call pattern in characterData
   [MCP Extension] Found code block with tool calls: <function_calls>...
   [MCP Extension] Parsed 1 tool call(s): [...]
   ```

2. ✅ **UI appears** below the code block:
   - Purple-gradient box with "🔧 Tool Call: filesystem.list_directory"
   - Parameters shown: `path: /Users/ASUS/Desktop`

3. ✅ **Auto-execution** (if enabled):
   - Shows "⚡ Auto-executing..."
   - Result appears in green success box
   - Lists all files from Desktop

4. ✅ **Manual execution** (if auto-execute OFF):
   - Shows "▶ Execute" button
   - Click to run
   - Result appears after clicking

**Example 2: Read File**
```
Read the contents of the file /Users/ASUS/Desktop/test.txt
```

**Expected:**
````xml
<function_calls>
<invoke name="filesystem.read_file" call_id="2">
<parameter name="path">/Users/ASUS/Desktop/test.txt</parameter>
</invoke>
</function_calls>
````

Should auto-detect, render UI, and execute.

**Example 3: Write File**
```
Create a file called hello.txt on my Desktop with the text "Hello World!"
```

**Expected:**
````xml
<function_calls>
<invoke name="filesystem.write_file" call_id="3">
<parameter name="path">/Users/ASUS/Desktop/hello.txt</parameter>
<parameter name="content">Hello World!</parameter>
</invoke>
</function_calls>
````

## 🐛 Debugging

### Issue: Tool Call Not Detected

**Check:**
1. Open Console (F12)
2. Look for logs: `[MCP Extension] Tool call pattern...`
3. If no logs, the mutation observer isn't firing

**Solutions:**
- Refresh ChatGPT page
- Check that MutationObserver is running: Look for `[MCP Extension] Monitoring started with enhanced detection`
- Make sure the tool call is in a code block (```)

### Issue: Tool Call Detected But No UI

**Check:**
1. Console should show: `[MCP Extension] Parsed X tool call(s)`
2. If parsed but no UI, check parent div detection

**Solutions:**
- Look for: `[MCP Extension] Could not find parent for code block`
- The UI should appear after the `<pre><code>` block

### Issue: Execution Fails

**Check:**
1. Extension popup shows "Connected"
2. MCP proxy server is running
3. Console shows the error

**Common Errors:**
- "Not connected to MCP server" → Reconnect in popup
- "Tool X not found" → Tool name mismatch or not available
- "Timeout" → MCP server not responding

### Issue: Instructions Not Working

**Problem:** ChatGPT doesn't use tools or doesn't output XML format

**Solution:**
1. Make sure you clicked "Insert Instructions" AND sent the message
2. The instructions must be in the conversation context
3. Start a fresh conversation and insert again

## 📊 Expected Console Output

When everything works correctly:

```
[MCP Extension] Initializing...
[MCP Extension] ChatGPT interface ready
[MCP Extension] Settings loaded: {enabled: true, autoExecute: true, ...}
[MCP Extension] 15 tools available
[MCP Extension] Monitoring started with enhanced detection
[MCP Extension] Tool call pattern in characterData
[MCP Extension] Found code block with tool calls: <function_calls><invoke name="filesystem...
[MCP Extension] Parsed 1 tool call(s): [{toolName: "filesystem.list_directory", ...}]
[MCP Extension] Auto-executing tool: filesystem.list_directory
[MCP Extension] Tool execution successful
```

## ✨ Success Criteria

Extension is working correctly if:

- [x] Console shows monitoring started
- [x] Tool call XML is detected in code blocks
- [x] UI renders below the code block
- [x] Auto-execute works (if enabled)
- [x] Manual execute works (if auto-execute disabled)
- [x] Results display in green/red boxes
- [x] Multiple tool calls in same conversation work
- [x] Sidebar shows available tools when enabled

## 🎯 Advanced Testing

### Test Streaming Detection

Ask: "List files one by one in /Users/ASUS/Desktop"

Watch as ChatGPT types the XML. The extension should detect it even while streaming.

### Test Multiple Tools

Ask: "List files in Desktop, then read the first .txt file you find"

Should detect and execute both tool calls sequentially.

### Test Error Handling

Ask: "Read the file /nonexistent/path.txt"

Should show error in red box.

## 📝 Notes

- Tool calls MUST be in code blocks (```)
- ChatGPT MUST use the XML format: `<function_calls><invoke>...</invoke></function_calls>`
- Instructions guide ChatGPT to use the correct format
- Without instructions, ChatGPT won't know how to format tool calls

## 🎉 Success!

If you see:
1. ✅ Tool call detected in console logs
2. ✅ UI renders with tool info
3. ✅ Execution runs (auto or manual)
4. ✅ Results display correctly

**The extension is working perfectly! 🚀**

---

**Next:** Try different tools, chain multiple calls, and explore the full MCP ecosystem!
