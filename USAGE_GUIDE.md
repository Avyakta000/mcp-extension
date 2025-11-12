# ChatGPT MCP Extension - Complete Usage Guide

## What This Extension Does

This Chrome extension bridges **ChatGPT** with your local **MCP (Model Context Protocol) servers**, allowing ChatGPT to execute real tools like:
- Reading/writing files on your computer
- Interacting with GitHub repositories
- Running terminal commands
- Accessing databases
- And any other MCP-compatible tools

## Quick Start (5 Minutes)

### 1. Start Your MCP Proxy

Make sure your proxy is running:

```bash
npx @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json
```

You should see output like:
```
MCP Proxy Server running on http://localhost:3006
SSE endpoint: http://localhost:3006/sse
WebSocket endpoint: ws://localhost:3006/message
```

### 2. Load the Extension

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Toggle "Developer mode" ON (top-right corner)
4. Click "Load unpacked"
5. Select the `dist` folder from `chatgpt-mcp-extension/dist`

### 3. Connect to Proxy

1. Click the extension icon in Chrome toolbar (🔧)
2. Click the purple "Connect to Proxy" button
3. Status should change to "● Connected"
4. You'll see your tool count (e.g., "Available Tools: 5")

### 4. Use in ChatGPT

1. Go to [chatgpt.com](https://chatgpt.com)
2. Look for a 🔧 button next to the ChatGPT input
3. Click it to see available tools
4. Ask ChatGPT to use a tool!

## Example Conversations

### Example 1: Reading Files

**You:**
```
Can you read the contents of C:\Users\YourName\Documents\notes.txt using the read_file tool?
```

**ChatGPT will respond with something like:**
```xml
<function_calls>
  <invoke name="read_file">
    <parameter name="path">C:\Users\YourName\Documents\notes.txt</parameter>
  </invoke>
</function_calls>
```

**The extension will:**
1. Detect this tool call
2. Show a beautiful execution button: `▶ Execute: read_file`
3. Display the arguments
4. When you click it, execute the tool
5. Show the file contents inline

### Example 2: GitHub Operations

**You:**
```
List all issues in the facebook/react repository using the github tool
```

**ChatGPT:**
```xml
<function_calls>
  <invoke name="github_list_issues">
    <parameter name="repo">facebook/react</parameter>
  </invoke>
</function_calls>
```

Click execute → See the issues → Continue conversation with the data!

### Example 3: Multiple Tools

**You:**
```
First, read my todo.txt file, then create a GitHub issue for each incomplete task
```

ChatGPT will generate multiple tool calls. Execute them one by one or ask ChatGPT to combine them!

## UI Elements

### 1. Extension Popup (Click Icon)

Shows:
- **Connection Status**: Green "● Connected" or Red "● Disconnected"
- **Transport Type**: SSE, WebSocket, or Streamable HTTP
- **Available Tools**: Count of tools from your MCP servers
- **Tools List**: Expandable list showing all tool names and descriptions

Buttons:
- **Connect to Proxy**: Establishes connection
- **Disconnect**: Closes connection
- **Refresh Tools**: Re-fetches tool list

### 2. ChatGPT Page Integration

**🔧 Button (Bottom-left of input):**
- Click to open tool browser sidebar
- Shows all available tools
- Click any tool to insert a template

**Tool Call Detection (In ChatGPT Messages):**
When ChatGPT includes a tool call, you'll see:

```
┌─────────────────────────────────────┐
│ 🔧 Tool Call: read_file             │
│                                     │
│ Arguments:                          │
│ {                                   │
│   "path": "/tmp/test.txt"           │
│ }                                   │
│                                     │
│ [▶ Execute: read_file]              │
└─────────────────────────────────────┘
```

**After Execution:**
```
✓ Executed: read_file

✓ Result:
Hello, this is the file content!

[Copy to Input]
```

## Tool Call Formats

The extension supports two formats:

### XML Format (Recommended for ChatGPT)

```xml
<function_calls>
  <invoke name="tool_name">
    <parameter name="arg1">value1</parameter>
    <parameter name="arg2">value2</parameter>
  </invoke>
</function_calls>
```

**Prompt to use this:**
```
Please format tool calls as XML using <function_calls> and <invoke> tags
```

### JSON Format (Line-delimited)

```json
{"type": "function_call_start", "name": "tool_name"}
{"type": "function_call_arg", "name": "arg1", "value": "value1"}
{"type": "function_call_arg", "name": "arg2", "value": "value2"}
{"type": "function_call_end"}
```

## Advanced Usage

### Instructing ChatGPT

For best results, tell ChatGPT about your tools:

```
You have access to the following MCP tools via the browser extension:

1. read_file(path: string) - Read file contents
2. write_file(path: string, content: string) - Write to file
3. github_list_issues(repo: string) - List GitHub issues
4. execute_command(command: string) - Run terminal command

When I ask you to perform actions, please use these tools by generating XML function calls in the format:
<function_calls>
  <invoke name="tool_name">
    <parameter name="param_name">value</parameter>
  </invoke>
</function_calls>

I will execute them through my browser extension and provide the results.
```

### Custom Instructions

Add this to your ChatGPT custom instructions:

```
I have a browser extension that allows you to execute MCP tools. When I ask you to perform file operations, GitHub actions, or system commands, please use XML-formatted tool calls. Wait for me to execute them and provide results before proceeding.
```

### Batch Operations

You can chain multiple tool calls:

```
Please:
1. Read config.json
2. Modify the "port" value to 8080
3. Write it back
4. Read it again to verify

Use the appropriate MCP tools for each step.
```

## Configuration

### Change Transport Type

Edit `src/background/index.ts`:

```typescript
const DEFAULT_CONFIG: ConnectionRequest = {
  uri: 'ws://localhost:3006/message',  // Changed to WebSocket
  type: 'websocket'  // Changed from 'sse'
};
```

Then rebuild:
```bash
npm run build
```

And reload the extension.

### Change Proxy URL

If your proxy runs on a different port:

```typescript
const DEFAULT_CONFIG: ConnectionRequest = {
  uri: 'http://localhost:8080/sse',  // Custom port
  type: 'sse'
};
```

### Customize UI Colors

Edit `src/content/tool-executor.ts` for button styles:

```typescript
button.style.cssText = `
  background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
  // ... other styles
`;
```

## Troubleshooting

### Issue: Extension Not Connecting

**Symptoms:**
- Popup shows "● Disconnected"
- Clicking "Connect" fails with error

**Solutions:**
1. Check proxy is running:
   ```bash
   curl http://localhost:3006/health
   ```

2. Check browser console:
   - Open extension popup
   - Right-click → Inspect
   - Look for error messages

3. Check background worker:
   - Go to `chrome://extensions/`
   - Click "Service worker" link under extension
   - Check for errors

4. Try different transport:
   - Edit `src/background/index.ts`
   - Change from SSE to WebSocket
   - Rebuild and reload

### Issue: Tool Calls Not Detected

**Symptoms:**
- ChatGPT generates tool calls but extension doesn't show execute button

**Solutions:**
1. Check console on ChatGPT page (F12):
   - Look for `[MCP Extension] Found X tool calls`

2. Verify format:
   - Must be XML with `<function_calls>` wrapper
   - Or JSON with `{"type": "function_call_start"}`

3. Try explicit format:
   ```
   Please format your tool call EXACTLY like this:
   <function_calls>
     <invoke name="read_file">
       <parameter name="path">/tmp/test.txt</parameter>
     </invoke>
   </function_calls>
   ```

4. Refresh the ChatGPT page

### Issue: Tool Execution Fails

**Symptoms:**
- Click execute button → Error message

**Solutions:**
1. Check tool exists:
   - Click extension icon
   - Verify tool is in the list
   - Click "Refresh Tools"

2. Check arguments:
   - Tool arguments must match schema
   - Check for typos in parameter names

3. Check proxy logs:
   - Look at terminal where proxy is running
   - Check for error messages

4. Try manual test:
   ```bash
   curl -X POST http://localhost:3006/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

### Issue: ChatGPT UI Changes

**Symptoms:**
- 🔧 button not appearing
- Can't insert text into ChatGPT

**Solutions:**
1. The extension uses multiple selector fallbacks
2. Open an issue on GitHub with:
   - Chrome version
   - ChatGPT URL
   - Screenshot of console errors

3. Temporary workaround:
   - Use tool call detection (still works)
   - Copy result manually into chat

## Best Practices

### 1. Security
- Never execute tools you don't trust
- Review tool arguments before clicking execute
- Keep your proxy local (don't expose to internet)

### 2. Performance
- Use SSE transport for lower overhead
- Close sidebar when not needed
- Disconnect when done using tools

### 3. Conversation Flow
- Execute tools one at a time
- Copy results to chat input using "Copy to Input" button
- Let ChatGPT see results before continuing

### 4. Tool Discovery
- Click 🔧 button to browse available tools
- Read tool descriptions before asking ChatGPT to use them
- Test tools individually before complex workflows

## Keyboard Shortcuts

Currently no keyboard shortcuts, but you can add them:

Edit `manifest.json`:
```json
"commands": {
  "toggle-sidebar": {
    "suggested_key": {
      "default": "Ctrl+Shift+M"
    },
    "description": "Toggle MCP tools sidebar"
  }
}
```

## Privacy & Security

- **No data leaves your machine** except to your local proxy
- Extension only communicates with `localhost:3006`
- Tool execution requires explicit user click
- No telemetry or tracking
- Open source - you can audit the code

## Limitations

- ChatGPT-only (for now)
- Requires local proxy running
- No auto-execution (deliberate for security)
- ProseMirror editor compatibility issues possible

## Roadmap

Future enhancements:
- [ ] Auto-execution with confirmation dialog
- [ ] Tool call history
- [ ] Keyboard shortcuts
- [ ] Dark mode
- [ ] Other AI platforms (Claude, Perplexity)
- [ ] Tool favorites
- [ ] Result formatting options

## Getting Help

1. Read this guide thoroughly
2. Check QUICKSTART.md for setup issues
3. Check README.md for technical details
4. Look at MCP SuperAssistant documentation
5. Open GitHub issue with:
   - Extension version
   - Chrome version
   - Proxy version
   - Console logs
   - Steps to reproduce

## Examples Gallery

### File Management
```
Please list all .txt files in C:\Users\Me\Documents and read the first one
```

### GitHub Workflow
```
Create a new issue in my repo (username/project) titled "Add dark mode" with description "Users want dark mode support"
```

### Data Processing
```
Read data.json, filter items where status="active", and save to active_data.json
```

### System Commands
```
Check the disk space usage in my home directory
```

## Contributing

Want to improve the extension?

1. Fork the repository
2. Make changes
3. Test thoroughly
4. Submit pull request

Areas that need help:
- Better UI/UX design
- More robust selectors for ChatGPT
- Additional transport options
- Documentation improvements

---

**Happy Tool Calling! 🚀**

Need more help? Open an issue on GitHub!
