# ChatGPT MCP Extension

A Chrome extension that integrates Model Context Protocol (MCP) tools with ChatGPT, allowing you to execute MCP tools directly from ChatGPT conversations.

## Features

- 🔌 **Connect to Local MCP Proxy** - Works with `mcp-superassistant-proxy` running on localhost:3006
- 🔧 **Tool Detection** - Automatically detects tool calls in ChatGPT responses (XML and JSON formats)
- ⚡ **One-Click Execution** - Execute detected tool calls with a single click
- 📊 **Beautiful UI** - Gradient buttons, inline results, and tool sidebar
- 🔄 **Three Transport Options** - WebSocket, SSE, and Streamable HTTP (just like MCP-SuperAssistant!)
- 📝 **Tool Browser** - View all available tools in a sidebar
- 🎨 **Non-Intrusive** - Seamlessly integrates with ChatGPT's interface
- 💾 **Settings Persistence** - Remembers your transport and URL preferences

## Prerequisites

1. **MCP Proxy Server** running on port 3006:
   ```bash
   npx @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json
   ```

2. **MCP Server Configuration** (`config.json`):
   ```json
   {
     "mcpServers": {
       "filesystem": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"]
       },
       "github": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-github"],
         "env": {
           "GITHUB_TOKEN": "your_token"
         }
       }
     }
   }
   ```

## Installation

### Development Mode

1. **Clone and Install Dependencies**:
   ```bash
   cd chatgpt-mcp-extension
   npm install
   ```

2. **Build the Extension**:
   ```bash
   npm run build
   ```

3. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from the project

### Production Build

```bash
npm run build
```

The extension will be built to the `dist` folder.

## Usage

### 1. Start the MCP Proxy

```bash
npx @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json
```

The proxy will start on `http://localhost:3006`.

### 2. Connect the Extension

- Click the extension icon in Chrome toolbar
- Click "Connect to Proxy"
- The extension will automatically connect via SSE transport

### 3. Use in ChatGPT

1. Go to [chatgpt.com](https://chatgpt.com)
2. Ask ChatGPT to use a tool, for example:
   ```
   Please use the read_file tool to read the contents of /path/to/file.txt
   ```

3. When ChatGPT's response includes a tool call, the extension will:
   - Detect the tool call (XML or JSON format)
   - Show an execution button
   - Display the tool arguments

4. Click the **"▶ Execute"** button to run the tool

5. The result will be displayed inline with options to:
   - View the result
   - Copy result to ChatGPT input
   - Continue the conversation

### 4. Browse Available Tools

- Click the 🔧 button next to the ChatGPT input
- A sidebar will open showing all available tools
- Click any tool to insert a template into the input

## Tool Call Formats

The extension detects two formats:

### XML Format (Claude-style)
```xml
<function_calls>
  <invoke name="read_file">
    <parameter name="path">/tmp/test.txt</parameter>
  </invoke>
</function_calls>
```

### JSON Format (Function calling)
```json
{"type": "function_call_start", "name": "read_file"}
{"type": "function_call_arg", "name": "path", "value": "/tmp/test.txt"}
{"type": "function_call_end"}
```

## Architecture

```
┌─────────────────────────────────────┐
│         ChatGPT Page                │
│  ┌──────────────────────────────┐   │
│  │   Content Script             │   │
│  │   - ChatGPT Adapter          │   │
│  │   - Tool Call Parser         │   │
│  │   - Tool Executor            │   │
│  │   - UI Injection             │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
              │
       chrome.runtime.sendMessage
              │
              ▼
┌─────────────────────────────────────┐
│     Background Service Worker       │
│  ┌──────────────────────────────┐   │
│  │   MCP Client                 │   │
│  │   - Connection Manager       │   │
│  │   - Tool Call Handler        │   │
│  │   - Event Emitter            │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
              │
        JSON-RPC 2.0
              │
              ▼
┌─────────────────────────────────────┐
│    MCP Proxy (localhost:3006)       │
│  ┌──────────────────────────────┐   │
│  │   Transport Handlers         │   │
│  │   - SSE                      │   │
│  │   - WebSocket                │   │
│  │   - Streamable HTTP          │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│        MCP Servers                  │
│  - Filesystem                       │
│  - GitHub                           │
│  - Custom Tools                     │
└─────────────────────────────────────┘
```

## Project Structure

```
chatgpt-mcp-extension/
├── manifest.json              # Extension manifest (Manifest V3)
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── webpack.config.js          # Webpack bundler config
├── src/
│   ├── background/
│   │   └── index.ts           # Background service worker
│   ├── content/
│   │   ├── index.ts           # Content script entry point
│   │   ├── chatgpt-adapter.ts # ChatGPT DOM manipulation
│   │   ├── tool-parser.ts     # Tool call detection
│   │   └── tool-executor.ts   # Tool execution UI
│   ├── mcp/
│   │   └── client.ts          # MCP client (JSON-RPC)
│   ├── popup/
│   │   ├── popup.html         # Extension popup UI
│   │   └── index.ts           # Popup logic
│   └── types/
│       └── index.ts           # TypeScript types
└── public/
    ├── icon16.png             # Extension icon (16x16)
    ├── icon48.png             # Extension icon (48x48)
    └── icon128.png            # Extension icon (128x128)
```

## Development

### Build for Development (with watch)
```bash
npm run dev
```

### Type Checking
```bash
npm run type-check
```

### Production Build
```bash
npm run build
```

## Configuration

### Transport Options

The extension supports **all three MCP transports**:

1. **WebSocket** (Default) - `ws://localhost:3006/message`
   - Fast, bidirectional, real-time
   - Auto-reconnects on disconnect
   - Best for interactive applications

2. **SSE** - `http://localhost:3006/sse`
   - Server-Sent Events, HTTP-based
   - Better firewall compatibility
   - Good for one-way streaming

3. **Streamable HTTP** - `http://localhost:3006/mcp`
   - Maximum compatibility
   - Works behind restrictive proxies
   - Standard HTTP requests

**To change transport:**
1. Click extension icon in Chrome toolbar
2. Enter your proxy URL
3. Select transport type from dropdown
4. Click "Connect to Proxy"

Settings are automatically saved and restored on extension restart.

**See THREE_TRANSPORTS.md for detailed comparison and usage guide.**

## Troubleshooting

### Extension Not Connecting

1. Check if proxy is running:
   ```bash
   curl http://localhost:3006/health
   ```

2. Check browser console for errors:
   - Open ChatGPT
   - Press F12 → Console tab
   - Look for `[MCP Extension]` logs

3. Check background service worker:
   - Go to `chrome://extensions/`
   - Click "Service worker" under the extension
   - Check for errors

### Tool Calls Not Detected

1. Make sure ChatGPT's response includes tool calls in supported formats
2. Check content script console for `[MCP Extension] Found X tool calls`
3. Try refreshing the ChatGPT page

### Tool Execution Fails

1. Check if the tool exists:
   - Click extension icon
   - Look at "Available Tools" count
   - Click "Refresh Tools"

2. Check tool arguments match the schema

3. Check proxy logs for errors

## Known Limitations

- Only works with ChatGPT (chatgpt.com)
- Requires local proxy server running
- ChatGPT UI changes may break selectors (uses multiple fallbacks)
- SSE transport requires separate POST endpoint for requests (currently uses WebSocket fallback)

## Future Enhancements

- [ ] Support for more AI platforms (Perplexity, Gemini, etc.)
- [ ] Tool call auto-execution (with user confirmation)
- [ ] Tool call history and retry
- [ ] Custom tool templates
- [ ] Configuration UI for connection settings
- [ ] Dark mode support for sidebar
- [ ] Tool result formatting options
- [ ] Export/import tool call sessions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License

## Credits

- Built for use with [MCP SuperAssistant Proxy](https://github.com/srbhptl39/MCP-SuperAssistant)
- Uses [Model Context Protocol](https://modelcontextprotocol.io/)
- Inspired by the MCP community

## Support

For issues and questions:
- Check the [Troubleshooting](#troubleshooting) section
- Open an issue on GitHub
- Check MCP SuperAssistant documentation

---

**Happy Tool Calling! 🔧✨**
