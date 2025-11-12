# MCP Settings Modal Feature

This document explains the new popup modal feature that appears when clicking the MCP button in ChatGPT.

## Features

The modal includes three main controls that match MCP-SuperAssistant:

### 1. **Enable MCP Toggle**
- **Purpose**: Opens/closes the MCP tools sidebar
- **Behavior**:
  - When enabled (ON), the sidebar appears on the right showing available MCP tools
  - When disabled (OFF), the sidebar is hidden
  - Setting is persisted across sessions

### 2. **Auto-execute Toggle**
- **Purpose**: Automatically execute tool calls detected in ChatGPT responses
- **Behavior**:
  - When enabled (ON), tool calls are automatically executed without clicking "Execute" button
  - When disabled (OFF), you must manually click the execute button for each tool call
  - Shows "⚡ Auto-executing..." indicator when auto-executing
  - Setting is persisted across sessions

### 3. **Instructions Textbox**
- **Purpose**: Customize how the LLM should behave when using MCP tools
- **Behavior**:
  - Enter custom instructions that guide ChatGPT's behavior
  - Example: "Always explain your reasoning before using tools"
  - Instructions are saved automatically (500ms debounce)
  - Can be used to add context or constraints for tool usage

## How It Works

1. **Click the MCP button** (purple circle with wrench icon) in ChatGPT's input area
2. **Modal appears** with the three controls
3. **Configure settings** as needed
4. **Click outside or press ✕** to close the modal
5. Settings are automatically saved to Chrome storage

## User Interface

### Modal Layout
```
┌─────────────────────────────────────┐
│ MCP Settings                     ✕  │
├─────────────────────────────────────┤
│                                     │
│ Enable MCP              [Toggle ON] │
│ Open MCP tools sidebar              │
│                                     │
│ Auto-execute            [Toggle ON] │
│ Automatically execute tool calls    │
│                                     │
│ Instructions                        │
│ Customize how the LLM should...    │
│ ┌─────────────────────────────────┐ │
│ │ [Your custom instructions...]   │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

## Storage Keys

Settings are stored in Chrome's local storage:
- `mcpEnabled`: boolean - MCP toggle state
- `mcpAutoExecute`: boolean - Auto-execute toggle state
- `mcpInstructions`: string - Custom instructions text

## Code Structure

### New Files
- `src/content/mcp-modal.ts` - Modal component implementation

### Modified Files
- `src/content/index.ts` - Integration with modal and settings management
- `src/content/tool-executor.ts` - Auto-execute functionality

### Key Classes

**MCPModal**
- `show()` - Display the modal
- `hide()` - Hide the modal
- `getSettings()` - Get current settings
- `updateSettings()` - Update settings programmatically

**MCPSettings Interface**
```typescript
interface MCPSettings {
  enabled: boolean;        // MCP sidebar enabled
  autoExecute: boolean;    // Auto-execute tool calls
  instructions: string;    // Custom instructions
}
```

## Auto-Execute Behavior

When auto-execute is enabled:
1. Tool calls are detected in ChatGPT responses
2. Instead of showing an "Execute" button, shows "⚡ Auto-executing..." indicator
3. Tool is executed immediately in the background
4. Result is displayed inline with success/error formatting
5. No manual intervention required

When auto-execute is disabled:
1. Tool calls are detected in ChatGPT responses
2. Shows manual "▶ Execute" button
3. User must click button to execute tool
4. Result is displayed after clicking

## Development Notes

### Callbacks
The modal uses callbacks to communicate with the main extension:
- `onToggleSidebar(enabled)` - Called when MCP toggle changes
- `onSettingsChange(settings)` - Called when any setting changes

### Persistence
All settings are automatically saved to Chrome storage and persist across:
- Browser restarts
- Extension reloads
- Tab navigation

### Initial State
On extension initialization:
- Settings are loaded from Chrome storage
- If MCP was enabled, sidebar opens automatically (500ms delay)
- Modal retains last saved state

## Usage Example

1. **Enable MCP and configure auto-execute:**
   - Click MCP button in ChatGPT
   - Toggle "Enable MCP" to ON
   - Toggle "Auto-execute" to ON
   - Sidebar opens showing available tools

2. **Add custom instructions:**
   - Type in instructions box: "Always verify file paths before reading"
   - Instructions auto-save after typing stops

3. **Use in conversation:**
   - Ask ChatGPT to use an MCP tool
   - Tool call is automatically executed (if auto-execute is ON)
   - Result appears inline in the conversation

## Styling

Modal uses inline CSS for consistency:
- Clean, modern design matching ChatGPT's aesthetic
- Purple accent colors (#667eea) matching MCP branding
- Smooth animations and transitions
- Responsive toggle switches
- Professional typography

## Future Enhancements

Potential improvements:
- [ ] Keyboard shortcuts (Ctrl+M to toggle modal)
- [ ] Export/import settings
- [ ] Multiple instruction presets
- [ ] Advanced auto-execute rules (e.g., only for specific tools)
- [ ] Confirmation prompt for destructive tools
