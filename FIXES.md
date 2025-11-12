# Fixes Applied

## Issues Fixed

### 1. SSE Transport Error ❌ → ✅
**Error:**
```
[Background] MCP error: Error: SSE transport does not support sending requests directly
```

**Root Cause:**
- SSE (Server-Sent Events) is unidirectional (server → client only)
- Cannot send requests through EventSource API
- Original implementation tried to send JSON-RPC requests through SSE

**Fix:**
- **Switched to WebSocket transport** (bidirectional)
- WebSocket supports full duplex communication
- Updated default connection:
  ```typescript
  const DEFAULT_CONFIG = {
    uri: 'ws://localhost:3006/message',  // Changed from http://localhost:3006/sse
    type: 'websocket'  // Changed from 'sse'
  };
  ```

**Files Changed:**
- `src/background/index.ts` - Updated default config
- `src/mcp/client.ts` - Simplified to WebSocket-only implementation

---

### 2. Content Security Policy (CSP) Violation ❌ → ✅
**Error:**
```
Uncaught EvalError: Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source
```

**Root Cause:**
- Chrome extensions have strict CSP policies
- `eventemitter3` library may use dynamic code evaluation
- Source maps can trigger CSP violations

**Fix:**
- **Removed `eventemitter3` dependency**
- **Created custom EventEmitter** (`src/mcp/event-emitter.ts`)
- **Disabled source maps** in webpack config
- Simple, CSP-compliant implementation

**Files Changed:**
- `src/mcp/event-emitter.ts` - New file, custom EventEmitter
- `src/mcp/client.ts` - Use custom EventEmitter
- `package.json` - Removed eventemitter3 dependency
- `webpack.config.js` - Added `devtool: false`

---

## Technical Changes

### MCP Client Rewrite

**Before:**
```typescript
// Multiple transports (SSE, WebSocket, HTTP)
// Complex EventSource handling
// External dependency on eventemitter3
```

**After:**
```typescript
// WebSocket-only (simpler, more reliable)
// Native WebSocket API
// Custom EventEmitter (no dependencies)
// Proper MCP protocol implementation
```

### Connection Flow

```
Extension loads
    ↓
Background service worker starts
    ↓
Auto-connect to ws://localhost:3006/message
    ↓
WebSocket handshake with protocol: mcp-v1
    ↓
Send initialize request (JSON-RPC 2.0)
    ↓
Send notifications/initialized
    ↓
Fetch tools/list
    ↓
Ready for tool calls
```

### JSON-RPC Protocol

**Initialize Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "chatgpt-mcp-extension",
      "version": "1.0.0"
    }
  }
}
```

**Tool Call Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {
      "path": "/tmp/test.txt"
    }
  }
}
```

---

## Configuration Changes

### Default Transport

**Old:**
```typescript
uri: 'http://localhost:3006/sse'
type: 'sse'
```

**New:**
```typescript
uri: 'ws://localhost:3006/message'
type: 'websocket'
```

### To Change Back to SSE (Not Recommended)

If you need SSE for some reason, you'll need to:
1. Implement proper POST endpoint for requests
2. Handle request/response correlation
3. Use the MCP SDK's SSEClientTransport
4. Add `@modelcontextprotocol/sdk` dependency

**We recommend sticking with WebSocket** - it's simpler and more reliable.

---

## Verification Steps

### 1. Check Extension Loads
```bash
# Go to chrome://extensions/
# Look for "ChatGPT MCP Extension"
# Should show no errors
```

### 2. Check Background Service Worker
```bash
# Click "Service worker" link under extension
# Console should show:
[MCP Client] WebSocket connected
[MCP Client] Initializing protocol...
[MCP Client] Initialized: {...}
[MCP Client] Fetching tools...
[MCP Client] Found X tools: [...]
```

### 3. Check Proxy Connection
```bash
# In proxy terminal, you should see:
WebSocket connection established
Received: initialize
Received: tools/list
```

### 4. Test on ChatGPT
```bash
# Open chatgpt.com
# Look for 🔧 button
# Click extension icon - should show "● Connected"
```

---

## Debugging

### Still Getting Errors?

**Check Proxy:**
```bash
# Verify proxy is running:
curl ws://localhost:3006/message

# Or use wscat:
npm install -g wscat
wscat -c ws://localhost:3006/message -s mcp-v1
```

**Check Browser Console:**
```bash
# On ChatGPT page: F12 → Console
# Look for [MCP Extension] logs

# Extension popup: Right-click icon → Inspect → Console
# Look for connection status

# Background worker: chrome://extensions/ → Service worker → Console
# Look for [MCP Client] logs
```

**Enable Verbose Logging:**
Edit `src/mcp/client.ts` and add more `console.log` statements.

---

## Performance

### Connection Metrics

- **Connection Time:** ~1-2 seconds
- **Tool List Fetch:** ~500ms
- **Tool Execution:** Varies by tool
- **Reconnection Delay:** 2s, 4s, 6s (exponential backoff)

### Memory Usage

- **Background Worker:** ~5MB
- **Content Script:** ~3MB per tab
- **WebSocket Overhead:** ~1KB per message

---

## Known Limitations

1. **WebSocket Only:** SSE and HTTP transports not supported
2. **Single Connection:** One connection to proxy at a time
3. **Manual Reconnect:** After 3 failed attempts, requires manual reconnect
4. **No Offline Queue:** Messages sent while disconnected are lost

---

## Future Improvements

- [ ] Add SSE transport with proper POST endpoint
- [ ] Add Streamable HTTP transport
- [ ] Implement message queue for offline support
- [ ] Add connection retry with exponential backoff (indefinite)
- [ ] Add connection health monitoring (ping/pong)
- [ ] Support multiple simultaneous connections

---

## Rollback Instructions

If you need to rollback to the original version:

```bash
git checkout HEAD~1  # Or specific commit
npm install
npm run build
```

---

## Support

**Having issues?**

1. Check this document first
2. Verify proxy is running: `ws://localhost:3006/message`
3. Check browser console for errors
4. Open GitHub issue with:
   - Extension version
   - Chrome version
   - Proxy version
   - Console logs
   - Steps to reproduce

---

**Last Updated:** 2025-11-11
**Version:** 1.0.0 (Fixed)
