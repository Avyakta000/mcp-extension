# Complete Implementation Guide - DOM Observation & Tool Execution

This guide explains what's missing and how to fix the tool call detection issue.

## 🔴 Problem Identified

Your extension didn't detect the tool call because:

1. **MutationObserver not properly configured** - Only watched for direct childList mutations
2. **No characterData observation** - Streaming content (text changes) wasn't monitored
3. **Parser only checked processed elements** - Didn't look for `<function_calls>` in actual chat messages
4. **Tool detection logic was passive** - Waited for manual triggers instead of actively watching

## ✅ Solution Architecture

Based on MCP-SuperAssistant, we need:

1. **Enhanced MutationObserver** - Watch for both element additions AND text changes
2. **Pattern detection** - Actively search for `<function_calls>`, `<invoke` patterns
3. **Code block targeting** - Look specifically in `<pre>` and `<code>` elements
4. **Streaming support** - Handle partial/incomplete tool calls as ChatGPT types
5. **Auto-render UI** - Create interactive blocks for each detected tool call

## 📝 Required Changes

### 1. Enhanced DOM Observation

**Current Code (Insufficient):**
```typescript
this.observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

**Improved Code:**
```typescript
this.observer.observe(document.body, {
  childList: true,           // Watch for new elements
  subtree: true,             // Watch entire tree
  characterData: true,       // Watch for text changes (CRITICAL!)
  characterDataOldValue: true // Track text changes
});
```

### 2. Pattern Detection in Mutations

**Add to Mutation Observer callback:**
```typescript
for (const mutation of mutations) {
  // 1. Check added nodes
  if (mutation.type === 'childList') {
    for (const node of Array.from(mutation.addedNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;

        // Check for code blocks or function_calls pattern
        if (element.tagName === 'PRE' || element.tagName === 'CODE' ||
            element.textContent?.includes('<function_calls>') ||
            element.textContent?.includes('<invoke')) {
          this.processElementForToolCalls(element);
        }

        // Also check child code blocks
        const codeBlocks = element.querySelectorAll('pre, code');
        codeBlocks.forEach(block => {
          if (block.textContent?.includes('<function_calls>')) {
            this.processElementForToolCalls(block as HTMLElement);
          }
        });
      }
    }
  }

  // 2. Check character data changes (streaming)
  if (mutation.type === 'characterData') {
    const text = mutation.target.textContent || '';
    if (text.includes('<function_calls>') || text.includes('<invoke')) {
      const parent = mutation.target.parentElement;
      if (parent) {
        this.processElementForToolCalls(parent);
      }
    }
  }
}
```

### 3. Target Code Blocks Specifically

**Add helper method:**
```typescript
private findCodeBlocksWithToolCalls(): HTMLElement[] {
  const blocks: HTMLElement[] = [];

  // Find all pre/code elements
  const selectors = [
    'pre code',  // ChatGPT uses this structure
    'pre',
    'code[class*="xml"]',
    'code[class*="language"]'
  ];

  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el: Element) => {
      const htmlEl = el as HTMLElement;
      const text = htmlEl.textContent || '';

      // Check for function call patterns
      if (text.includes('<function_calls>') || text.includes('<invoke')) {
        blocks.push(htmlEl);
      }
    });
  });

  return blocks;
}
```

### 4. Process Tool Calls from Code Blocks

**Update checkElementForToolCalls:**
```typescript
private checkElementForToolCalls(element: HTMLElement): void {
  // Skip if already processed
  if (this.processedElements.has(element)) {
    return;
  }

  // Get text content
  const textContent = element.textContent || '';

  // Must contain function_calls pattern
  if (!textContent.includes('<function_calls>') && !textContent.includes('<invoke')) {
    return;
  }

  console.log('[MCP Extension] Found tool call pattern:', textContent.substring(0, 100));

  // Mark as processed
  this.processedElements.add(element);

  // Parse the tool calls
  const toolCalls = this.parser.parseMessage(textContent);

  if (toolCalls.length > 0) {
    console.log(`[MCP Extension] Detected ${toolCalls.length} tool call(s)`);

    // Find or create container for rendering
    const container = this.getOrCreateToolCallContainer(element);

    // Render each tool call
    toolCalls.forEach(async (toolCall) => {
      await this.renderToolCallUI(toolCall, container);
    });
  }
}
```

### 5. Create Inline UI for Tool Calls

**Add render method:**
```typescript
private async renderToolCallUI(
  toolCall: DetectedToolCall,
  container: HTMLElement
): Promise<void> {
  // Create wrapper div
  const wrapper = document.createElement('div');
  wrapper.className = 'mcp-tool-call-detected';
  wrapper.style.cssText = `
    margin: 12px 0;
    padding: 16px;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
    border-left: 4px solid #667eea;
    border-radius: 8px;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  // Tool name header
  const header = document.createElement('div');
  header.style.cssText = `
    font-weight: 600;
    font-size: 15px;
    color: #667eea;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  header.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
    <span>Tool Call: ${toolCall.toolName}</span>
  `;

  wrapper.appendChild(header);

  // Parameters display
  if (toolCall.arguments && Object.keys(toolCall.arguments).length > 0) {
    const paramsDiv = this.executor.createArgumentsDisplay(toolCall);
    wrapper.appendChild(paramsDiv);
  }

  // Auto-execute or manual execute
  if (this.mcpSettings.enabled && this.mcpSettings.autoExecute) {
    // Auto-execute
    const statusDiv = document.createElement('div');
    statusDiv.textContent = '⚡ Auto-executing...';
    statusDiv.style.cssText = `
      padding: 8px 12px;
      background: #dbeafe;
      border-radius: 6px;
      font-size: 13px;
      color: #1e40af;
      margin-top: 8px;
    `;
    wrapper.appendChild(statusDiv);

    // Execute immediately
    container.appendChild(wrapper);
    await this.executor.executeToolInContainer(toolCall, wrapper);
  } else {
    // Manual execute button
    const executeBtn = this.executor.createExecutionButton(toolCall, wrapper);
    wrapper.appendChild(executeBtn);
    container.appendChild(wrapper);
  }
}
```

### 6. Find or Create Container

**Helper to insert UI after code block:**
```typescript
private getOrCreateToolCallContainer(codeElement: HTMLElement): HTMLElement {
  // Check if container already exists
  let container = codeElement.parentElement?.querySelector('.mcp-tool-calls-container') as HTMLElement;

  if (!container) {
    container = document.createElement('div');
    container.className = 'mcp-tool-calls-container';
    container.style.cssText = `
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Insert after the code block's parent
    const parent = codeElement.closest('div[class*="group"]');
    if (parent) {
      parent.appendChild(container);
    } else {
      codeElement.parentElement?.appendChild(container);
    }
  }

  return container;
}
```

## 🎯 Complete Flow

1. **ChatGPT generates response** with `<function_calls>` XML
2. **MutationObserver fires** on characterData or childList change
3. **Pattern detection** finds `<function_calls>` in code block
4. **Parser extracts** tool name and parameters from XML
5. **UI renders** inline after the code block
6. **Auto-execute or manual** based on settings
7. **Result displays** in the UI

## 🚀 Testing Steps

1. Insert instructions into ChatGPT (via modal button)
2. Send a task requiring tool use: "List files in /Users/ASUS/Desktop"
3. ChatGPT responds with:
   ```xml
   <function_calls>
     <invoke name="filesystem.list_directory" call_id="1">
       <parameter name="path">/Users/ASUS/Desktop</parameter>
     </invoke>
   </function_calls>
   ```
4. Extension should:
   - ✅ Detect the code block
   - ✅ Parse the XML
   - ✅ Render the tool call UI
   - ✅ Execute the tool (if auto-execute is ON)
   - ✅ Display results

## 📊 Debug Logging

Add comprehensive logging:
```typescript
console.log('[MCP Extension] Mutation detected:', mutation.type);
console.log('[MCP Extension] Text content:', textContent.substring(0, 200));
console.log('[MCP Extension] Contains function_calls:', textContent.includes('<function_calls>'));
console.log('[MCP Extension] Parsed tool calls:', toolCalls);
console.log('[MCP Extension] Executing tool:', toolCall.toolName);
console.log('[MCP Extension] Result:', result);
```

## 🔧 Key Differences from Current Code

| Current | Fixed |
|---------|-------|
| Only watches childList | Watches childList + characterData |
| No streaming support | Handles streaming content |
| Checks processed elements only | Actively searches all code blocks |
| Passive detection | Active pattern matching |
| No auto-render | Renders UI immediately |
| Manual execution only | Auto-execute support |

## ⚡ Performance Optimization

To avoid processing every mutation:

```typescript
// Debounce processing
private processingTimeout: NodeJS.Timeout | null = null;

private scheduleProcessing(element: HTMLElement): void {
  if (this.processingTimeout) {
    clearTimeout(this.processingTimeout);
  }

  this.processingTimeout = setTimeout(() => {
    this.checkElementForToolCalls(element);
  }, 100); // Wait 100ms for streaming to settle
}
```

## 📚 References

See MCP-SuperAssistant implementation:
- `pages/content/src/render_prescript/src/observer/mutationObserver.ts` (lines 208-310)
- `pages/content/src/render_prescript/src/parser/functionParser.ts` (lines 12-81)
- `pages/content/src/render_prescript/src/renderer/functionBlock.ts` (lines 1-150)

---

**Apply these changes to make tool call detection work! 🎉**
