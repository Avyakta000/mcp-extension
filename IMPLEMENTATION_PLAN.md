# Full Three-Transport Implementation Plan

## Current Status
- ✅ MCP SDK installed (`@modelcontextprotocol/sdk@^1.0.2`)
- ✅ Directory structure created
- ✅ Plugin types defined
- ⏳ Need to implement 8+ files

## Files Needed for Full Implementation

### 1. Transport Layer (3 files)
1. `src/mcp/transports/websocket/WebSocketTransport.ts` (~235 lines)
   - Custom WebSocket implementation
   - Message queuing, ping/pong, reconnection logic

### 2. Plugin Layer (3 files)
2. `src/mcp/plugins/sse/SSEPlugin.ts` (~200 lines)
   - Wraps SDK's SSEClientTransport
3. `src/mcp/plugins/websocket/WebSocketPlugin.ts` (~290 lines)
   - Wraps custom WebSocketTransport
4. `src/mcp/plugins/streamable-http/StreamableHttpPlugin.ts` (~195 lines)
   - Wraps SDK's StreamableHTTPClientTransport

### 3. Client Layer (2 files)
5. `src/mcp/client.ts` (~600 lines)
   - Plugin registry and selection
   - Connection management
   - Tool calling orchestration
6. `src/mcp/plugin-registry.ts` (~150 lines)
   - Plugin registration and lifecycle
   - Transport selection logic

### 4. UI Updates (2 files)
7. `src/popup/index.ts` - Add transport selector dropdown
8. `src/popup/popup.html` - Add UI controls

##Decision Point

I can implement this in two ways:

### Option A: Full Plugin Architecture (Like MCP-SuperAssistant)
**Pros:**
- Exactly matches MCP-SuperAssistant architecture
- Easy to add more transports later
- Better separation of concerns
- More maintainable

**Cons:**
- 8+ files to create (~1500+ lines of code)
- Takes longer to implement
- More complex to debug initially

**Time:** ~30 minutes of implementation

### Option B: Simplified Multi-Transport Client
**Pros:**
- Simpler architecture (3-4 files)
- Faster to implement
- Easier to understand and debug
- Still supports all 3 transports

**Cons:**
- Less modular
- Harder to extend with new transports
- Doesn't match MCP-SuperAssistant exactly

**Time:** ~10 minutes of implementation

## Recommended Approach

**Option B (Simplified)** with a clear path to upgrade to Option A later.

This gives you:
- ✅ All three transports working immediately
- ✅ UI to switch between them
- ✅ Proper MCP SDK usage
- ✅ Production-ready code
- ⏫ Easy upgrade path to full plugin architecture

##Simplified Implementation Structure

```
src/mcp/
├── client.ts           # Main client with built-in transport switching
├── transports/
│   └── websocket-transport.ts   # Custom WebSocket (needed for SDK)
├── event-emitter.ts    # Already exists
└── types/
    └── plugin.ts       # Already exists
```

The client will:
1. Accept transport type in connect()
2. Create appropriate transport from SDK
3. Use MCP Client class from SDK
4. Handle all three transports internally

## Next Steps

**Would you like me to:**

1. **Implement Option A (Full Plugin Architecture)** - Complete, professional, matches MCP-SuperAssistant exactly
2. **Implement Option B (Simplified Multi-Transport)** - Faster, simpler, still fully functional
3. **Show me the code first** - I'll generate all files and let you review before applying

Please let me know your preference and I'll proceed accordingly!
