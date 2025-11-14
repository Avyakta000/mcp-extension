import { DetectedToolCall, MessageType, ExtensionMessage, ToolCallRequest } from '../types';
import { ChatGPTAdapter } from './chatgpt-adapter';

export class ToolExecutor {
  private adapter: ChatGPTAdapter;
  private executingTools = new Set<string>();

  constructor(adapter: ChatGPTAdapter) {
    this.adapter = adapter;
  }

  /**
   * Create execution button for a detected tool call
   */
  createExecutionButton(toolCall: DetectedToolCall, container: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'mcp-execute-btn';
    button.textContent = `▶ Execute: ${toolCall.toolName}`;
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      margin: 8px 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    // Hover effect
    button.onmouseenter = () => {
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
    };
    button.onmouseleave = () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    };

    button.onclick = async () => {
      await this.executeToolCall(toolCall, button, container);
    };

    return button;
  }

  /**
   * Execute a tool call and display result (public method for auto-execute)
   */
  async executeToolInContainer(toolCall: DetectedToolCall, container: HTMLElement): Promise<void> {
    if (this.executingTools.has(toolCall.id)) {
      return;
    }

    this.executingTools.add(toolCall.id);

    // Check connection status first
    try {
      const statusResponse = await chrome.runtime.sendMessage({
        type: MessageType.MCP_GET_STATUS
      });

      if (!statusResponse.success || !statusResponse.data?.isConnected) {
        this.displayAutoExecuteError(
          toolCall,
          'MCP server not connected. Please check connection in settings.',
          container
        );
        this.executingTools.delete(toolCall.id);
        return;
      }
    } catch (error) {
      this.displayAutoExecuteError(
        toolCall,
        'Unable to check connection status. Please reload the page.',
        container
      );
      this.executingTools.delete(toolCall.id);
      return;
    }

    // Create a status indicator
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = `
      padding: 8px 12px;
      background: #fef3c7;
      border-radius: 6px;
      font-size: 13px;
      color: #92400e;
      margin-top: 8px;
    `;
    statusDiv.textContent = `⏳ Executing: ${toolCall.toolName}...`;

    // Find the auto-execute indicator and replace it
    const autoExecuteIndicator = container.querySelector('div[style*="dbeafe"]');
    if (autoExecuteIndicator) {
      container.replaceChild(statusDiv, autoExecuteIndicator);
    } else {
      container.appendChild(statusDiv);
    }

    try {
      // Call background script to execute tool
      const response = await chrome.runtime.sendMessage({
        type: MessageType.MCP_CALL_TOOL,
        payload: {
          toolName: toolCall.toolName,
          arguments: toolCall.arguments
        } as ToolCallRequest
      });

      // Remove status indicator
      statusDiv.remove();

      if (response.success) {
        this.displayAutoExecuteSuccess(toolCall, response.data, container);
      } else {
        this.displayAutoExecuteError(toolCall, response.error || 'Unknown error', container);
      }
    } catch (error: any) {
      statusDiv.remove();
      this.displayAutoExecuteError(toolCall, error.message || 'Execution failed', container);
    } finally {
      this.executingTools.delete(toolCall.id);
    }
  }

  /**
   * Execute a tool call and display result (private - for manual button clicks)
   */
  private async executeToolCall(
    toolCall: DetectedToolCall,
    button: HTMLButtonElement,
    container: HTMLElement
  ): Promise<void> {
    if (this.executingTools.has(toolCall.id)) {
      return;
    }

    this.executingTools.add(toolCall.id);

    // Update button to loading state
    button.disabled = true;
    button.textContent = `⏳ Executing: ${toolCall.toolName}...`;
    button.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    button.style.cursor = 'wait';

    try {
      // Call background script to execute tool
      const response = await chrome.runtime.sendMessage({
        type: MessageType.MCP_CALL_TOOL,
        payload: {
          toolName: toolCall.toolName,
          arguments: toolCall.arguments
        } as ToolCallRequest
      });

      if (response.success) {
        this.displaySuccess(toolCall, response.data, button, container);
      } else {
        this.displayError(toolCall, response.error || 'Unknown error', button, container);
      }
    } catch (error: any) {
      this.displayError(toolCall, error.message || 'Execution failed', button, container);
    } finally {
      this.executingTools.delete(toolCall.id);
    }
  }

  /**
   * Display successful auto-execute result
   */
  private displayAutoExecuteSuccess(toolCall: DetectedToolCall, result: any, container: HTMLElement): void {
    // Create result display
    const resultDiv = document.createElement('div');
    resultDiv.className = 'mcp-result';
    resultDiv.style.cssText = `
      margin: 12px 0;
      padding: 12px;
      background: rgba(16, 185, 129, 0.1);
      border-left: 3px solid #10b981;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    `;

    // Format result content
    const content = this.formatToolResult(result);
    resultDiv.innerHTML = `
      <div style="font-weight: 600; color: #10b981; margin-bottom: 8px;">
        ✓ Auto-executed successfully
      </div>
      <div style="color: #374151; white-space: pre-wrap; word-break: break-word;">
        ${this.escapeHtml(content)}
      </div>
    `;

    container.appendChild(resultDiv);
  }

  /**
   * Display auto-execute error
   */
  private displayAutoExecuteError(toolCall: DetectedToolCall, error: string, container: HTMLElement): void {
    // Create error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'mcp-error';
    errorDiv.style.cssText = `
      margin: 12px 0;
      padding: 12px;
      background: rgba(239, 68, 68, 0.1);
      border-left: 3px solid #ef4444;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    `;

    errorDiv.innerHTML = `
      <div style="font-weight: 600; color: #ef4444; margin-bottom: 8px;">
        ✗ Auto-execute failed:
      </div>
      <div style="color: #374151;">
        ${this.escapeHtml(error)}
      </div>
    `;

    container.appendChild(errorDiv);
  }

  /**
   * Display successful tool execution result
   */
  private displaySuccess(
    toolCall: DetectedToolCall,
    result: any,
    button: HTMLButtonElement,
    container: HTMLElement
  ): void {
    // Update button
    button.textContent = `✓ Executed: ${toolCall.toolName}`;
    button.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
    button.style.cursor = 'default';

    // Create result display
    const resultDiv = document.createElement('div');
    resultDiv.className = 'mcp-result';
    resultDiv.style.cssText = `
      margin: 12px 0;
      padding: 12px;
      background: rgba(16, 185, 129, 0.1);
      border-left: 3px solid #10b981;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    `;

    // Format result content
    const content = this.formatToolResult(result);
    resultDiv.innerHTML = `
      <div style="font-weight: 600; color: #10b981; margin-bottom: 8px;">
        ✓ Result:
      </div>
      <div style="color: #374151; white-space: pre-wrap; word-break: break-word;">
        ${this.escapeHtml(content)}
      </div>
    `;

    // Add copy button
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy to Input';
    copyBtn.style.cssText = `
      margin-top: 8px;
      padding: 4px 8px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    `;
    copyBtn.onclick = () => {
      this.adapter.appendText(`Tool Result (${toolCall.toolName}):\n${content}`);
    };

    resultDiv.appendChild(copyBtn);
    container.appendChild(resultDiv);
  }

  /**
   * Display tool execution error
   */
  private displayError(
    toolCall: DetectedToolCall,
    error: string,
    button: HTMLButtonElement,
    container: HTMLElement
  ): void {
    // Update button
    button.textContent = `✗ Failed: ${toolCall.toolName}`;
    button.style.background = 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)';
    button.style.cursor = 'default';

    // Create error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'mcp-error';
    errorDiv.style.cssText = `
      margin: 12px 0;
      padding: 12px;
      background: rgba(239, 68, 68, 0.1);
      border-left: 3px solid #ef4444;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    `;

    errorDiv.innerHTML = `
      <div style="font-weight: 600; color: #ef4444; margin-bottom: 8px;">
        ✗ Error:
      </div>
      <div style="color: #374151;">
        ${this.escapeHtml(error)}
      </div>
    `;

    container.appendChild(errorDiv);
  }

  /**
   * Format tool result for display
   */
  private formatToolResult(result: any): string {
    if (!result) {
      return 'No result';
    }

    // Handle MCP result format: { content: [...] }
    if (result.content && Array.isArray(result.content)) {
      return result.content
        .map((item: any) => {
          if (item.type === 'text') {
            return item.text || '';
          }
          return JSON.stringify(item, null, 2);
        })
        .join('\n\n');
    }

    // Handle plain object
    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }

    return String(result);
  }

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create arguments display
   */
  createArgumentsDisplay(toolCall: DetectedToolCall): HTMLElement {
    const argsDiv = document.createElement('div');
    argsDiv.className = 'mcp-arguments';
    argsDiv.style.cssText = `
      margin: 8px 0;
      padding: 8px;
      background: rgba(59, 130, 246, 0.05);
      border-left: 2px solid #3b82f6;
      border-radius: 4px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
    `;

    const argsText = JSON.stringify(toolCall.arguments, null, 2);
    argsDiv.innerHTML = `
      <div style="font-weight: 600; color: #3b82f6; margin-bottom: 4px;">
        Arguments:
      </div>
      <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; color: #374151;">
${this.escapeHtml(argsText)}
      </pre>
    `;

    return argsDiv;
  }
}
