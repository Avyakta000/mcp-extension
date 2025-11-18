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
      color: #000000;
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

    // Find the run button to update its state
    const runBtn = container.querySelector('.run-btn') as HTMLButtonElement;

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
        this.resetButtonState(runBtn);
        this.executingTools.delete(toolCall.id);
        return;
      }
    } catch (error) {
      this.displayAutoExecuteError(
        toolCall,
        'Unable to check connection status. Please reload the page.',
        container
      );
      this.resetButtonState(runBtn);
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
        // Check if the result contains an error message
        const resultText = this.formatToolResult(response.data);
        const isError = resultText.toLowerCase().includes('error:') ||
                       resultText.toLowerCase().includes('"error"') ||
                       resultText.toLowerCase().includes('invalid') ||
                       (response.data?.isError === true);

        if (isError) {
          this.displayAutoExecuteError(toolCall, resultText, container);
        } else {
          this.displayAutoExecuteSuccess(toolCall, response.data, container);
        }
      } else {
        this.displayAutoExecuteError(toolCall, response.error || 'Unknown error', container);
      }

      // Reset button state after execution
      this.resetButtonState(runBtn);
    } catch (error: any) {
      statusDiv.remove();
      this.displayAutoExecuteError(toolCall, error.message || 'Execution failed', container);
      // Reset button state after error
      this.resetButtonState(runBtn);
    } finally {
      this.executingTools.delete(toolCall.id);
    }
  }

  /**
   * Reset button state after execution
   */
  private resetButtonState(button: HTMLButtonElement | null): void {
    if (!button) return;

    button.disabled = false;
    button.style.opacity = '1';
    button.innerHTML = '✓ Completed';
    button.style.background = '#ffffff';

    // Reset to original state after a delay
    setTimeout(() => {
      button.innerHTML = '▶ Run';
      button.style.background = '#ffffff';
    }, 2000);
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
      background: #0a0a0a;
      border-left: 3px solid #ffffff;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    `;

    // Format result content
    const content = this.formatToolResult(result);
    resultDiv.innerHTML = `
      <div style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">
        ✓ Auto-executed successfully
      </div>
      <div style="color: #cccccc; white-space: pre-wrap; word-break: break-word;">
        ${this.escapeHtml(content)}
      </div>
    `;

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 12px;
    `;

    // Add copy button
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Result';
    copyBtn.style.cssText = `
      padding: 6px 12px;
      background: #ffffff;
      color: #000000;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;
    copyBtn.onmouseover = () => {
      copyBtn.style.background = '#cccccc';
    };
    copyBtn.onmouseout = () => {
      copyBtn.style.background = '#ffffff';
    };
    copyBtn.onclick = () => {
      const wrappedContent = `<function_result call_id="${toolCall.id}">\n${content}\n</function_result>`;
      this.adapter.appendText(wrappedContent);
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Result';
      }, 1500);
    };

    // Add attach button
    const attachBtn = document.createElement('button');
    attachBtn.textContent = 'Attach to Input';
    attachBtn.style.cssText = `
      padding: 6px 12px;
      background: #ffffff;
      color: #000000;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;
    attachBtn.onmouseover = () => {
      attachBtn.style.background = '#cccccc';
    };
    attachBtn.onmouseout = () => {
      attachBtn.style.background = '#ffffff';
    };
    attachBtn.onclick = () => {
      const wrappedContent = `<function_result call_id="${toolCall.id}">\n${content}\n</function_result>`;
      this.adapter.insertText(wrappedContent);
      attachBtn.textContent = '✓ Attached!';
      setTimeout(() => {
        attachBtn.textContent = 'Attach to Input';
      }, 1500);
    };

    buttonsContainer.appendChild(copyBtn);
    buttonsContainer.appendChild(attachBtn);
    resultDiv.appendChild(buttonsContainer);
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
      background: #0a0a0a;
      border-left: 3px solid #ffffff;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    `;

    errorDiv.innerHTML = `
      <div style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">
        ✗ Auto-execute failed:
      </div>
      <div style="color: #cccccc;">
        ${this.escapeHtml(error)}
      </div>
    `;

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 12px;
    `;

    // Add copy error button
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Error';
    copyBtn.style.cssText = `
      padding: 6px 12px;
      background: #ffffff;
      color: #000000;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;
    copyBtn.onmouseover = () => {
      copyBtn.style.background = '#cccccc';
    };
    copyBtn.onmouseout = () => {
      copyBtn.style.background = '#ffffff';
    };
    copyBtn.onclick = () => {
      const wrappedContent = `<function_result call_id="${toolCall.id}" status="error">\nError: ${error}\n</function_result>`;
      this.adapter.appendText(wrappedContent);
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Error';
      }, 1500);
    };

    buttonsContainer.appendChild(copyBtn);
    errorDiv.appendChild(buttonsContainer);
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
      background: #0a0a0a;
      border-left: 3px solid #ffffff;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    `;

    // Format result content
    const content = this.formatToolResult(result);
    resultDiv.innerHTML = `
      <div style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">
        ✓ Result:
      </div>
      <div style="color: #cccccc; white-space: pre-wrap; word-break: break-word;">
        ${this.escapeHtml(content)}
      </div>
    `;

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 12px;
    `;

    // Add copy button
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Result';
    copyBtn.style.cssText = `
      padding: 6px 12px;
      background: #ffffff;
      color: #000000;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;
    copyBtn.onmouseover = () => {
      copyBtn.style.background = '#cccccc';
    };
    copyBtn.onmouseout = () => {
      copyBtn.style.background = '#ffffff';
    };
    copyBtn.onclick = () => {
      const wrappedContent = `<function_result call_id="${toolCall.id}">\n${content}\n</function_result>`;
      this.adapter.appendText(wrappedContent);
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Result';
      }, 1500);
    };

    // Add attach button
    const attachBtn = document.createElement('button');
    attachBtn.textContent = 'Attach to Input';
    attachBtn.style.cssText = `
      padding: 6px 12px;
      background: #ffffff;
      color: #000000;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;
    attachBtn.onmouseover = () => {
      attachBtn.style.background = '#cccccc';
    };
    attachBtn.onmouseout = () => {
      attachBtn.style.background = '#ffffff';
    };
    attachBtn.onclick = () => {
      const wrappedContent = `<function_result call_id="${toolCall.id}">\n${content}\n</function_result>`;
      this.adapter.insertText(wrappedContent);
      attachBtn.textContent = '✓ Attached!';
      setTimeout(() => {
        attachBtn.textContent = 'Attach to Input';
      }, 1500);
    };

    buttonsContainer.appendChild(copyBtn);
    buttonsContainer.appendChild(attachBtn);
    resultDiv.appendChild(buttonsContainer);
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
      background: #0a0a0a;
      border-left: 3px solid #ffffff;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    `;

    errorDiv.innerHTML = `
      <div style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">
        ✗ Error:
      </div>
      <div style="color: #cccccc;">
        ${this.escapeHtml(error)}
      </div>
    `;

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 12px;
    `;

    // Add copy error button
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Error';
    copyBtn.style.cssText = `
      padding: 6px 12px;
      background: #ffffff;
      color: #000000;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;
    copyBtn.onmouseover = () => {
      copyBtn.style.background = '#cccccc';
    };
    copyBtn.onmouseout = () => {
      copyBtn.style.background = '#ffffff';
    };
    copyBtn.onclick = () => {
      const wrappedContent = `<function_result call_id="${toolCall.id}" status="error">\nError: ${error}\n</function_result>`;
      this.adapter.appendText(wrappedContent);
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Error';
      }, 1500);
    };

    buttonsContainer.appendChild(copyBtn);
    errorDiv.appendChild(buttonsContainer);
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
      background: #0a0a0a;
      border-left: 2px solid #ffffff;
      border-radius: 4px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
    `;

    const argsText = JSON.stringify(toolCall.arguments, null, 2);
    argsDiv.innerHTML = `
      <div style="font-weight: 600; color: #ffffff; margin-bottom: 4px;">
        Arguments:
      </div>
      <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; color: #cccccc;">
${this.escapeHtml(argsText)}
      </pre>
    `;

    return argsDiv;
  }
}
