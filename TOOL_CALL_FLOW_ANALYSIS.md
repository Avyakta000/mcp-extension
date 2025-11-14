# MCP-SuperAssistant Tool Call Flow Analysis

## Overview
This document explains how MCP-SuperAssistant implements the complete tool call detection, parsing, UI injection, and execution flow.

## Architecture Components

### 1. Detection Layer (mutationObserver.ts)
**Location**: `render_prescript/src/observer/mutationObserver.ts`

**Purpose**: Detect tool calls in ChatGPT responses in real-time

**Key Functions**:
- `startDirectMonitoring()` - Initializes MutationObserver on document.body
- `checkForUnprocessedFunctionCalls()` - Scans for unprocessed tool call blocks
- `processFunctionCalls()` - Main entry point for processing

**Detection Patterns**:
```javascript
// XML Detection
const hasXMLPattern =
  element.textContent.includes('<function_calls>') ||
  element.textContent.includes('<invoke');

// JSON Detection
const hasJSONPattern =
  textContent.includes('"type"') &&
  (textContent.includes('function_call') || textContent.includes('parameter'));
```

**MutationObserver Configuration**:
```javascript
functionCallObserver.observe(document.body, {
  childList: true,        // Watch for added/removed nodes
  subtree: true,          // Watch entire tree
  characterData: true,    // Watch for text changes
  characterDataOldValue: true
});
```

**Target Selectors** (from CONFIG):
```javascript
targetSelectors: ['pre', 'code', 'div[class*="code"]']
```

### 2. Streaming Monitor (streamObserver.ts)
**Location**: `render_prescript/src/observer/streamObserver.ts`

**Purpose**: Monitor individual blocks for streaming content updates

**Key Functions**:
- `monitorNode(node, blockId)` - Sets up per-block MutationObserver
- `detectFunctionChunk()` - Detects new chunks of streaming content
- `processChunkImmediate()` - Processes chunks with minimal delay
- `resyncWithOriginalContent()` - Syncs rendered UI with source

**Streaming Detection**:
- Monitors characterData changes in real-time
- Detects incomplete tags: `<invoke>` without `</invoke>`
- Uses chunk detection for immediate response (10-150ms delays)
- Handles parameter content caching to prevent loss during streaming

### 3. Parsing Layer (parser files)
**Location**: `render_prescript/src/parser/`

**XML Parsing**:
```javascript
// Extract function name and call ID
const invokeMatch = /<invoke name="([^"]+)"(?:\s+call_id="([^"]+)")?>/i;
functionName = invokeMatch[1];
callId = invokeMatch[2];

// Extract parameters
const paramStartRegex = /<parameter\s+name="([^"]+)"[^>]*>/gs;
// ... extract content between <parameter> and </parameter>
```

**JSON Parsing**:
```javascript
// Detect function call start
{"type": "function_call_start", "name": "tool_name"}

// Detect parameters
{"type": "parameter", "name": "arg1", "value": "value1"}

// Detect end
{"type": "function_call_end"}
```

### 4. Rendering Layer (functionBlock.ts + index.ts)
**Location**: `render_prescript/src/renderer/`

**Main Rendering Function**: `renderFunctionCall(block, isProcessingRef)`

**Rendering Process**:

1. **Check if block contains function calls**:
```javascript
const functionInfo = containsFunctionCalls(block);
if (!functionInfo.hasFunctionCalls) return false;
```

2. **Generate unique block ID**:
```javascript
const blockId = block.getAttribute('data-block-id') ||
  `block-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
```

3. **Create custom UI block**:
```javascript
const blockDiv = document.createElement('div');
blockDiv.className = 'function-block';
blockDiv.setAttribute('data-block-id', blockId);
```

4. **Add function name section** with spinner during streaming:
```javascript
const functionNameElement = createFunctionNameSection(
  functionName,
  callId,
  isComplete,
  isPreExistingIncomplete
);
blockDiv.appendChild(functionNameElement);
```

5. **Add expandable content section** (collapsed by default):
```javascript
const expandableContent = createExpandableContent();
blockDiv.appendChild(expandableContent);

// Inside expandableContent:
const paramsContainer = createElement('div', 'function-params');
expandableContent.appendChild(paramsContainer);
```

6. **Render parameters** with streaming support:
```javascript
Object.entries(parameters).forEach(([paramName, value]) => {
  const isParamStreaming = !rawContent.includes(`</parameter>`);
  createOrUpdateParamElement(
    paramsContainer,
    paramName,
    value,
    blockId,
    isNewRender,
    isParamStreaming
  );
});
```

7. **Hide original XML block and insert rendered UI**:
```javascript
if (isNewRender) {
  if (block.parentNode) {
    block.parentNode.insertBefore(blockDiv, block);
    block.style.display = 'none';  // ← KEY: Hide the XML
  }
}
```

8. **Add buttons when complete**:
```javascript
if (functionInfo.isComplete) {
  addRawXmlToggle(buttonContainer, rawContent);
  addExecuteButton(buttonContainer, rawContent);

  // Setup auto-execution if enabled
  if (autoExecuteEnabled) {
    setupOptimizedAutoExecution(blockId, functionDetails);
  }
}
```

### 5. Execution Layer (components.ts + mcpexecute/)
**Location**: `render_prescript/src/renderer/components.ts`

**Execute Button Handler**:
```javascript
addExecuteButton(container, rawContent) {
  const button = createElement('button', 'execute-button');
  button.onclick = async () => {
    // 1. Extract function name and parameters
    const functionInfo = parseFunctionCall(rawContent);

    // 2. Send to background script for MCP execution
    const result = await chrome.runtime.sendMessage({
      type: 'EXECUTE_TOOL',
      data: {
        serverName: functionInfo.serverName,
        toolName: functionInfo.toolName,
        arguments: functionInfo.arguments
      }
    });

    // 3. Handle result - inject back into chat or display
    if (result.success) {
      // Insert result into chat input or display in UI
      handleToolResult(result.data);
    }
  };
}
```

**Auto-Execute**:
```javascript
setupOptimizedAutoExecution(blockId, functionDetails) {
  const automationState = window.__mcpAutomationState;
  const autoExecuteDelay = (automationState?.autoExecuteDelay || 0) * 1000;

  setTimeout(() => {
    const block = document.querySelector(`.function-block[data-block-id="${blockId}"]`);
    const executeButton = block?.querySelector('.execute-button');
    if (executeButton) {
      executeButton.click();
    }
  }, autoExecuteDelay + 500);
}
```

### 6. Result Handling (functionResult.ts + functionResultObserver.ts)
**Location**: `render_prescript/src/renderer/functionResult.ts`

**Watches for**: `<function_result>` tags in responses

**Renders**: Similar structured UI showing execution results

## UI Structure

The rendered function call block has this DOM structure:

```html
<div class="function-block" data-block-id="block-123">
  <!-- Language tag (if present) -->
  <div class="language-tag">xml</div>

  <!-- Function name section with expand button -->
  <div class="function-name">
    <div class="function-name-left">
      <div class="function-name-row">
        <span class="function-name-text">search_web</span>
        <div class="spinner"></div> <!-- Only during streaming -->
      </div>
    </div>
    <div class="function-name-right">
      <span class="call-id">call_abc123</span>
      <button class="expand-button">▼</button>
    </div>
  </div>

  <!-- Expandable content (collapsed by default) -->
  <div class="expandable-content" style="display: none">
    <div class="function-params">
      <div class="param-name" data-param-id="block-123-query">query</div>
      <div class="param-value" data-param-id="block-123-query" data-streaming="true">
        <div class="content-wrapper">
          <pre>latest AI news</pre>
        </div>
      </div>
    </div>
  </div>

  <!-- Buttons (shown when complete) -->
  <div class="function-buttons">
    <button class="raw-toggle">Show Raw XML</button>
    <button class="execute-button">Execute</button>
  </div>
</div>

<!-- Original XML block (hidden) -->
<pre style="display: none">
<function_calls>
  <invoke name="search_web" call_id="call_abc123">
    <parameter name="query">latest AI news</parameter>
  </invoke>
</function_calls>
</pre>
```

## State Management

### Tracking Processed Elements
```javascript
export const processedElements = new WeakSet<HTMLElement>();
export const renderedFunctionBlocks = new Map<string, HTMLDivElement>();

// Mark as processed to avoid re-rendering
processedElements.add(block);
renderedFunctionBlocks.set(blockId, blockDiv);
```

### Execution Tracking
```javascript
const executionTracker = {
  attempts: new Map<string, number>(),
  executed: new Set<string>(),
  executedFunctions: new Set<string>(),

  isFunctionExecuted(callId, signature, functionName),
  markFunctionExecuted(callId, signature, functionName),
  isBlockExecuted(blockId),
  markBlockExecuted(blockId)
};
```

## Key Features

### 1. Auto-Expand During Streaming
```javascript
if (isStreaming) {
  const blockDiv = container.closest('.function-block');
  if (blockDiv && !blockDiv.classList.contains('expanded')) {
    AutoExpandUtils.expandBlock(blockDiv, true);
  }
}
```

### 2. Auto-Collapse After Completion
```javascript
if (blockDiv.classList.contains('auto-expanded')) {
  AutoExpandUtils.scheduleAutoCollapse(blockDiv, 1500);
}
```

### 3. Streaming Content Auto-Scroll
```javascript
ScrollUtils.performStreamingScroll(paramValueElement) {
  // Reset user scroll tracking
  paramValueElement._userHasScrolled = false;

  // Force scroll to bottom
  paramValueElement.scrollTo({
    top: paramValueElement.scrollHeight,
    behavior: 'smooth'
  });
}
```

### 4. Deduplication
- Checks `processedElements` WeakSet to avoid re-processing
- Uses `executionTracker` to prevent duplicate executions
- Generates content signatures to identify identical tool calls

## Performance Optimizations

1. **WeakMap/WeakSet for caching** - Auto garbage collection
2. **requestAnimationFrame batching** - Smooth DOM updates
3. **Debounced streaming updates** - 16ms (60fps)
4. **Element query caching** - Reduces DOM queries
5. **Content hash caching** - Avoids re-parsing unchanged content

## Initialization

Entry point is in the content script:

```javascript
import { initializeObserver } from './observer/mutationObserver';
import { initializeFunctionResultObserver } from './observer/functionResultObserver';

// Start watching for tool calls
initializeObserver();
initializeFunctionResultObserver();
```

## Summary

**The complete flow**:

1. **MutationObserver** detects XML/JSON patterns in ChatGPT responses
2. **Parser** extracts function name, call ID, and parameters
3. **Renderer** creates custom UI block and **hides original XML**
4. **Monitor** watches for streaming updates in real-time
5. **Execution** button triggers MCP tool call
6. **Result** is displayed or fed back to chat for summarization

The key insight: **They hide the original XML block and insert a custom rendered UI** instead of trying to modify the existing block.
