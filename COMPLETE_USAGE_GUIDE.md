# Complete MCP ChatGPT Extension Usage Guide

This guide explains the complete implementation based on MCP-SuperAssistant's architecture.

## How It Works

The extension integrates with ChatGPT by:
1. **Generating a system prompt** with all available MCP tools and their schemas
2. **Inserting this prompt into ChatGPT** (via button click, not automatically)
3. **ChatGPT reads the prompt** and learns about available tools
4. **ChatGPT outputs tool calls** in XML format when needed
5. **Extension detects and executes** the tool calls

## Step-by-Step Usage

### 1. Connect to MCP Proxy Server

1. Make sure your MCP proxy server is running at `http://localhost:3006`
2. Open the extension popup (click the extension icon)
3. Select your transport type (SSE, WebSocket, or Streamable HTTP)
4. Click "Connect"
5. Wait for "Connected" status

### 2. Open ChatGPT

1. Navigate to `https://chatgpt.com`
2. You should see a **purple MCP button** inline with other input buttons (voice, etc.)
3. If not inline, you'll see a floating purple circle button (fallback)

### 3. Configure MCP Settings

Click the purple MCP button to open the settings modal with:

#### **Enable MCP Toggle**
- Turn this ON to open the sidebar with available tools
- When enabled, you'll see all connected MCP tools in the sidebar

#### **Auto-execute Toggle**
- Turn this ON to automatically execute tool calls without manual confirmation
- Turn OFF to manually approve each tool execution

#### **Instructions Textbox**
- Add custom instructions for how ChatGPT should behave
- Example: "Always verify file paths before reading files"
- These instructions are included in the system prompt

### 4. Insert MCP Instructions (CRITICAL STEP!)

**This is the key difference from automatic systems:**

1. In the modal, scroll down to see two buttons:
   - **Copy Instructions** - Copies to clipboard, you paste manually
   - **Insert Instructions** - Directly inserts into ChatGPT input

2. Click **"Insert Instructions"** button
   - This inserts a LARGE system prompt into ChatGPT's input
   - The prompt teaches ChatGPT about:
     - How to use MCP tools
     - XML format for function calls
     - List of ALL available tools with parameters
     - Your custom instructions

3. **Send the prompt to ChatGPT** (press Enter or click Send)
   - ChatGPT will acknowledge the instructions
   - The conversation now "knows" about available tools

### 5. Use MCP Tools

Now you can ask ChatGPT to use your MCP tools:

```
You: "Read the file at /path/to/file.txt"
```

ChatGPT will respond with:

```
I'll help you read that file.

```xml
<function_calls>
<invoke name="read_file" call_id="1">
<parameter name="path">/path/to/file.txt</parameter>
</invoke>
</function_calls>
```
```

### 6. Tool Execution

**If auto-execute is ON:**
- The tool executes automatically
- Result appears inline with "✓ Auto-executed successfully"
- Result is shown in green success box

**If auto-execute is OFF:**
- You see a manual "▶ Execute" button
- Click to run the tool
- Result appears after execution

### 7. Continue Conversation

After tool execution:
- The result is displayed in ChatGPT
- You can optionally copy the result to input
- Ask follow-up questions or chain multiple tools

## System Prompt Format

When you click "Insert Instructions", this is what gets inserted:

```markdown
[Start Fresh Session from here][IMPORTANT]

<SYSTEM>
You are SuperAssistant with the capabilities of invoke functions...

Function Call Structure:
- All function calls should be wrapped in 'xml' codeblocks tags like ```xml ... ```.
- Wrap all function calls in 'function_calls' tags
- Each function call uses 'invoke' tags with a 'name' attribute
...

## AVAILABLE TOOLS FOR SUPERASSISTANT

 - read_file
**Description**: Read the complete contents of a file from the file system
**Parameters**:
- `path`: Path to file (string) (required)

 - write_file
**Description**: Create a new file or completely overwrite an existing file
**Parameters**:
- `path`: Path to file (string) (required)
- `content`: Content to write to the file (string) (required)

...

<custom_instructions>
Your custom instructions here
</custom_instructions>

<\SYSTEM>

User Interaction Starts here:
```

## Tool Call XML Format

ChatGPT uses this XML format (wrapped in ```xml code blocks):

```xml
<function_calls>
<invoke name="tool_name" call_id="1">
<parameter name="param1">value1</parameter>
<parameter name="param2">value2</parameter>
</invoke>
</function_calls>
```

**Important:**
- `call_id` starts at 1 and increments for each call
- Parameters with JSON objects use proper JSON format
- Always wrapped in ```xml code fence

## Troubleshooting

### MCP Button Not Appearing
- **Solution**: Refresh the ChatGPT page
- **Fallback**: Look for floating purple circle in bottom-right corner

### Instructions Not Working
- **Problem**: ChatGPT doesn't use tools or doesn't recognize them
- **Solution**: Make sure you clicked "Insert Instructions" AND sent the prompt
- **Check**: The instructions must be in the conversation context

### Tool Calls Not Detected
- **Problem**: Extension doesn't show execute button
- **Solution 1**: Make sure ChatGPT uses ```xml code blocks
- **Solution 2**: Check console (F12) for detection logs
- **Solution 3**: Tool call must match exact XML format

### Auto-Execute Not Working
- **Problem**: Tools don't execute automatically
- **Solution**: Check that "Auto-execute" toggle is ON in the modal
- **Verify**: Look for "⚡ Auto-executing..." indicator

### Tool Execution Fails
- **Problem**: Tool execution shows error
- **Solution 1**: Check MCP proxy server is running
- **Solution 2**: Verify connection status in popup
- **Solution 3**: Check tool parameters are correct

### Instructions Too Long
- **Problem**: ChatGPT input has character limit
- **Solution 1**: Reduce number of connected tools
- **Solution 2**: Simplify custom instructions
- **Solution 3**: Use "Copy Instructions" and paste in new chat

## Best Practices

### 1. Start Fresh Conversations
- Insert instructions at the START of a new chat
- Don't insert in middle of existing conversation
- ChatGPT needs the context from the beginning

### 2. One Tool Per Response
- ChatGPT should call ONE tool at a time
- The system prompt enforces this
- Sequential tool calls work better

### 3. Verify Parameters
- Check that required parameters are provided
- ChatGPT will ask for missing parameters
- Use exact parameter names from the schema

### 4. Use Custom Instructions
- Add domain-specific guidance
- Example: "Always verify file paths exist before writing"
- Example: "Explain your reasoning before using tools"

### 5. Monitor Execution
- Keep sidebar open to see available tools
- Check console (F12) for detailed logs
- Verify tool execution results

## Advanced Usage

### Multiple MCP Servers
1. Connect to multiple MCP proxy endpoints
2. Each server's tools appear in the list
3. All tools included in instructions
4. ChatGPT can use any available tool

### Custom Transport Types
- **SSE**: Best for server-sent events
- **WebSocket**: Best for bidirectional, low-latency
- **Streamable HTTP**: Best for HTTP streaming

### Keyboard Shortcuts (Future)
- Planned: `Ctrl+M` to toggle modal
- Planned: `Ctrl+I` to insert instructions
- Planned: `Ctrl+Shift+E` to toggle auto-execute

## Comparison with MCP-SuperAssistant

Our implementation matches MCP-SuperAssistant's ChatGPT integration:

| Feature | MCP-SuperAssistant | Our Extension |
|---------|-------------------|---------------|
| System prompt generation | ✅ | ✅ |
| Copy/Insert instructions | ✅ | ✅ |
| XML tool call format | ✅ | ✅ |
| Auto-execute mode | ✅ | ✅ |
| Custom instructions | ✅ | ✅ |
| Tool detection | ✅ | ✅ |
| Inline button | ✅ | ✅ |
| Sidebar with tools | ✅ | ✅ |

## Example Workflow

Here's a complete example:

1. **Start MCP proxy**: `npx @srbhptl39/mcp-superassistant-proxy@latest --config ./config.json`

2. **Connect extension**: Open popup → Select WebSocket → Connect

3. **Open ChatGPT**: Navigate to `https://chatgpt.com`

4. **Click MCP button**: Purple button appears inline with input

5. **Enable MCP**: Toggle "Enable MCP" to ON

6. **Enable Auto-execute**: Toggle "Auto-execute" to ON

7. **Add custom instruction**: "Always explain what you're about to do"

8. **Insert instructions**: Click "Insert Instructions" button

9. **Send prompt**: Press Enter to send the system prompt

10. **Ask ChatGPT**: "List all files in my Documents folder"

11. **Tool executes**: `list_directory` tool runs automatically

12. **Result appears**: File list shown in ChatGPT

13. **Continue**: "Read the README.md file"

14. **Another tool**: `read_file` executes

15. **Chain tools**: ChatGPT can chain multiple operations

## Important Notes

- **Instructions must be inserted ONCE per conversation**
- **The prompt teaches ChatGPT how to use tools**
- **Without instructions, ChatGPT won't know about MCP tools**
- **Auto-execute is optional but convenient**
- **Custom instructions enhance AI behavior**
- **Keep proxy server running at all times**

## Next Steps

After following this guide:
1. Test with simple tools (read_file, list_directory)
2. Try chaining multiple tool calls
3. Experiment with custom instructions
4. Monitor execution logs
5. Report any issues

## Support

If you encounter issues:
1. Check console logs (F12)
2. Verify proxy server is running
3. Ensure instructions were inserted
4. Check tool call XML format
5. Review this guide's troubleshooting section

---

**Happy tool calling! 🚀**
