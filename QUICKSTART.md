# Quick Start Guide

## Prerequisites

Make sure you have:
- Chrome browser installed
- MCP proxy running: `npx @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json`
- Proxy accessible at `ws://localhost:3006/message`

## Step 1: Install Dependencies

```bash
cd chatgpt-mcp-extension
npm install
```

## Step 2: Add Icons

You need to add icon files before building. Quick option using emoji:

1. Go to https://favicon.io/emoji-favicons/
2. Select 🔧 (wrench) emoji
3. Generate and download
4. Extract the PNG files
5. Rename and copy to `public/`:
   - favicon-16x16.png → icon16.png
   - favicon-32x32.png → icon48.png (resize to 48x48)
   - android-chrome-192x192.png → icon128.png (resize to 128x128)

Or create placeholder icons quickly:
```bash
# On Windows (requires ImageMagick):
magick -size 16x16 xc:purple public/icon16.png
magick -size 48x48 xc:purple public/icon48.png
magick -size 128x128 xc:purple public/icon128.png

# On macOS (requires ImageMagick):
convert -size 16x16 xc:purple public/icon16.png
convert -size 48x48 xc:purple public/icon48.png
convert -size 128x128 xc:purple public/icon128.png
```

## Step 3: Build the Extension

```bash
npm run build
```

This will create a `dist/` folder with the built extension.

## Step 4: Start the MCP Proxy

In a separate terminal:

```bash
npx @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json
```

Make sure you have a `config.json` file with your MCP servers:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\Users\\YourName\\Documents"]
    }
  }
}
```

## Step 5: Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `dist/` folder from the project
6. The extension icon should appear in the toolbar

## Step 6: Test the Extension

1. Click the extension icon
2. Click "Connect to Proxy" button
3. Status should change to "● Connected"
4. Open [ChatGPT](https://chatgpt.com)
5. You should see a 🔧 button next to the input
6. Ask ChatGPT: "Please list the files in my documents folder using the filesystem tool"

## Troubleshooting

### Build Errors

If you get TypeScript errors, try:
```bash
npm run type-check
```

### Extension Not Loading

- Check that `dist/manifest.json` exists
- Check browser console for errors
- Try rebuilding: `npm run build`

### Proxy Connection Failed

- Verify proxy is running: `curl http://localhost:3006/health`
- Check that no firewall is blocking port 3006
- Check proxy logs for errors

### Tool Calls Not Detected

- Try both XML and JSON formats
- Check browser console (F12) for logs
- Refresh the ChatGPT page

## Development Mode

For active development with auto-rebuild:

```bash
npm run dev
```

Then reload the extension in Chrome after each build:
- Go to `chrome://extensions/`
- Click refresh icon under the extension

## Next Steps

- Customize the connection settings in `src/background/index.ts`
- Add more MCP servers to your `config.json`
- Modify the UI styling in `src/content/tool-executor.ts`
- Check out the full README.md for advanced usage

---

Happy hacking! 🚀
