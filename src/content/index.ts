import { ChatGPTAdapter } from './chatgpt-adapter';
import { ToolCallParser } from './tool-parser';
import { ToolExecutor } from './tool-executor';
import { MCPModal, MCPSettings } from './mcp-modal';
import { MessageType, ConnectionStatus, MCPTool, DetectedToolCall } from '../types';

class ChatGPTMCPExtension {
  private adapter: ChatGPTAdapter;
  private parser: ToolCallParser;
  private executor: ToolExecutor;
  private modal: MCPModal;
  private connectionStatus: ConnectionStatus = { isConnected: false };
  private availableTools: MCPTool[] = [];
  private processedElements = new WeakSet<HTMLElement>();
  private sidebarOpen = false;
  private observer: MutationObserver | null = null;
  private mcpSettings: MCPSettings = {
    enabled: false,
    autoExecute: false,
    instructions: ''
  };

  constructor() {
    this.adapter = new ChatGPTAdapter();
    this.parser = new ToolCallParser();
    this.executor = new ToolExecutor(this.adapter);
    this.modal = new MCPModal(
      this.adapter,
      (enabled) => this.handleMCPToggle(enabled),
      (settings) => this.handleSettingsChange(settings)
    );

    console.log('[MCP Extension] Initializing...');
  }

  /**
   * Initialize the extension
   */
  async initialize(): Promise<void> {
    // Wait for ChatGPT to be ready
    const isReady = await this.adapter.waitForReady();
    if (!isReady) {
      console.error('[MCP Extension] ChatGPT interface not ready');
      return;
    }

    console.log('[MCP Extension] ChatGPT interface ready');

    // Load saved settings
    await this.loadSettings();

    // Connect to background script
    await this.connectToBackground();

    // Create MCP button
    this.createMCPButton();

    // Start monitoring for tool calls
    this.startMonitoring();

    // Listen to messages from background
    this.setupMessageListener();

    console.log('[MCP Extension] Initialization complete');
  }

  /**
   * Load settings from chrome storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(['mcpEnabled', 'mcpAutoExecute', 'mcpInstructions']);
      this.mcpSettings = {
        enabled: stored.mcpEnabled ?? false,
        autoExecute: stored.mcpAutoExecute ?? false,
        instructions: stored.mcpInstructions ?? ''
      };

      console.log('[MCP Extension] Settings loaded:', this.mcpSettings);

      // If MCP was enabled, open sidebar
      if (this.mcpSettings.enabled) {
        setTimeout(() => this.showToolsSidebar(), 500);
      }
    } catch (error) {
      console.error('[MCP Extension] Failed to load settings:', error);
    }
  }

  /**
   * Connect to background script and get status
   */
  private async connectToBackground(): Promise<void> {
    try {
      // Get connection status
      const statusResponse = await chrome.runtime.sendMessage({
        type: MessageType.MCP_GET_STATUS
      });

      if (statusResponse.success) {
        this.connectionStatus = statusResponse.data;
        console.log('[MCP Extension] Connection status:', this.connectionStatus);
      }

      // Get available tools
      const toolsResponse = await chrome.runtime.sendMessage({
        type: MessageType.MCP_LIST_TOOLS
      });

      if (toolsResponse.success && toolsResponse.data?.tools) {
        this.availableTools = toolsResponse.data.tools;
        this.modal.updateTools(this.availableTools);
        console.log(`[MCP Extension] ${this.availableTools.length} tools available`);
      }
    } catch (error) {
      console.error('[MCP Extension] Failed to connect to background:', error);
    }
  }

  /**
   * Create MCP toggle button
   */
  private createMCPButton(): void {
    const button = this.adapter.createMCPButton(() => {
      this.modal.show();
    });

    if (button) {
      this.updateButtonState(button);
      console.log('[MCP Extension] MCP button created');
    }
  }

  /**
   * Handle MCP toggle from modal
   */
  private handleMCPToggle(enabled: boolean): void {
    console.log('[MCP Extension] MCP toggled:', enabled);
    this.mcpSettings.enabled = enabled;

    if (enabled) {
      this.showToolsSidebar();
    } else {
      this.hideToolsSidebar();
    }
  }

  /**
   * Handle settings change from modal
   */
  private handleSettingsChange(settings: MCPSettings): void {
    console.log('[MCP Extension] Settings changed:', settings);
    this.mcpSettings = settings;

    // If instructions changed and MCP is enabled, optionally inject instructions
    if (settings.enabled && settings.instructions) {
      this.injectInstructions(settings.instructions);
    }
  }

  /**
   * Inject custom instructions into the chat input (optional)
   */
  private injectInstructions(instructions: string): void {
    // This could prepend instructions to the current input
    // For now, just log - you can customize this behavior
    console.log('[MCP Extension] Instructions to apply:', instructions);
  }

  /**
   * Update button state based on connection
   */
  private updateButtonState(button: HTMLButtonElement): void {
    if (this.connectionStatus.isConnected) {
      button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      button.title = `MCP Tools (Connected via ${this.connectionStatus.transport})`;
    } else {
      button.style.background = 'linear-gradient(135deg, #bbb 0%, #888 100%)';
      button.title = 'MCP Tools (Disconnected)';
    }
  }

  /**
   * Toggle sidebar (placeholder for now)
   */
  private toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    console.log('[MCP Extension] Sidebar toggled:', this.sidebarOpen);

    // TODO: Implement sidebar UI showing available tools
    if (this.sidebarOpen) {
      this.showToolsSidebar();
    } else {
      this.hideToolsSidebar();
    }
  }

  /**
   * Show tools sidebar
   */
  private showToolsSidebar(): void {
    // Check if sidebar already exists
    let sidebar = document.getElementById('mcp-tools-sidebar');
    if (sidebar) {
      sidebar.style.display = 'block';
      return;
    }

    // Create sidebar
    sidebar = document.createElement('div');
    sidebar.id = 'mcp-tools-sidebar';
    sidebar.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 320px;
      height: 100vh;
      background: white;
      box-shadow: -2px 0 8px rgba(0,0,0,0.1);
      z-index: 10000;
      overflow-y: auto;
      padding: 16px;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
    `;

    const title = document.createElement('h2');
    title.textContent = 'MCP Tools';
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #111827;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px 8px;
    `;
    closeBtn.onclick = () => this.hideToolsSidebar();

    header.appendChild(title);
    header.appendChild(closeBtn);
    sidebar.appendChild(header);

    // Connection status
    const status = document.createElement('div');
    status.style.cssText = `
      margin-bottom: 16px;
      padding: 8px 12px;
      background: ${this.connectionStatus.isConnected ? '#d1fae5' : '#fee2e2'};
      border-radius: 6px;
      font-size: 13px;
      color: ${this.connectionStatus.isConnected ? '#065f46' : '#991b1b'};
    `;
    status.textContent = this.connectionStatus.isConnected
      ? `✓ Connected (${this.connectionStatus.transport})`
      : '✗ Disconnected';
    sidebar.appendChild(status);

    // Tools list
    const toolsList = document.createElement('div');
    toolsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    if (this.availableTools.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.textContent = 'No tools available';
      emptyState.style.cssText = `
        padding: 32px 16px;
        text-align: center;
        color: #6b7280;
        font-size: 14px;
      `;
      toolsList.appendChild(emptyState);
    } else {
      this.availableTools.forEach(tool => {
        const toolCard = this.createToolCard(tool);
        toolsList.appendChild(toolCard);
      });
    }

    sidebar.appendChild(toolsList);
    document.body.appendChild(sidebar);
  }

  /**
   * Create tool card for sidebar
   */
  private createToolCard(tool: MCPTool): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = `
      padding: 12px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    card.onmouseenter = () => {
      card.style.background = '#f3f4f6';
      card.style.borderColor = '#d1d5db';
    };
    card.onmouseleave = () => {
      card.style.background = '#f9fafb';
      card.style.borderColor = '#e5e7eb';
    };

    const name = document.createElement('div');
    name.textContent = tool.name;
    name.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      color: #111827;
      margin-bottom: 4px;
    `;

    const description = document.createElement('div');
    description.textContent = tool.description || 'No description';
    description.style.cssText = `
      font-size: 12px;
      color: #6b7280;
      line-height: 1.4;
    `;

    card.appendChild(name);
    card.appendChild(description);

    // Click to insert tool template
    card.onclick = () => {
      const template = this.generateToolTemplate(tool);
      this.adapter.insertText(template);
      this.hideToolsSidebar();
    };

    return card;
  }

  /**
   * Generate tool template for insertion
   */
  private generateToolTemplate(tool: MCPTool): string {
    let template = `Please use the ${tool.name} tool`;

    if (tool.inputSchema?.properties) {
      const args = Object.keys(tool.inputSchema.properties);
      if (args.length > 0) {
        template += ` with the following parameters:\n`;
        args.forEach(arg => {
          template += `- ${arg}: [value]\n`;
        });
      }
    }

    return template;
  }

  /**
   * Hide tools sidebar
   */
  private hideToolsSidebar(): void {
    const sidebar = document.getElementById('mcp-tools-sidebar');
    if (sidebar) {
      sidebar.style.display = 'none';
    }
    this.sidebarOpen = false;
  }

  /**
   * Start monitoring for tool calls
   */
  private startMonitoring(): void {
    console.log('[MCP Extension] Starting monitoring...');

    // Initial scan
    this.scanForToolCalls();

    // Set up mutation observer with enhanced configuration
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check added nodes
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;

              // Check if this element contains code blocks with tool calls
              if (this.containsPotentialToolCall(element)) {
                console.log('[MCP Extension] Potential tool call detected in new element');
                this.scanForToolCalls();
                break;
              }
            } else if (node.nodeType === Node.TEXT_NODE) {
              // Check text nodes for tool call patterns
              const text = node.textContent || '';
              if (text.includes('<function_calls>') || text.includes('<invoke')) {
                console.log('[MCP Extension] Tool call pattern in text node');
                this.scanForToolCalls();
                break;
              }
            }
          }
        }

        // Check characterData changes (streaming content)
        if (mutation.type === 'characterData') {
          const text = mutation.target.textContent || '';
          if (text.includes('<function_calls>') || text.includes('<invoke')) {
            console.log('[MCP Extension] Tool call pattern in characterData');
            this.scanForToolCalls();
            break;
          }
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,  // CRITICAL: Watch for text changes
      characterDataOldValue: true
    });

    console.log('[MCP Extension] Monitoring started with enhanced detection');
  }

  /**
   * Check if element potentially contains tool calls
   */
  private containsPotentialToolCall(element: HTMLElement): boolean {
    const text = element.textContent || '';

    // Check for XML pattern
    if (text.includes('<function_calls>') || text.includes('<invoke')) {
      return true;
    }

    // Check if it's a code block
    if (element.tagName === 'PRE' || element.tagName === 'CODE') {
      return true;
    }

    // Check if it contains code blocks
    if (element.querySelector('pre, code')) {
      return true;
    }

    return false;
  }

  /**
   * Scan for tool calls in code blocks
   */
  private scanForToolCalls(): void {
    // Look specifically for code blocks that might contain function_calls
    const codeBlocks = document.querySelectorAll('pre code, pre, code');

    codeBlocks.forEach((block: Element) => {
      const codeElement = block as HTMLElement;

      // Skip if already processed
      if (this.processedElements.has(codeElement)) {
        return;
      }

      const text = codeElement.textContent || '';

      // Must contain function_calls pattern
      if (!text.includes('<function_calls>') && !text.includes('<invoke')) {
        return;
      }

      console.log('[MCP Extension] Found code block with tool calls:', text.substring(0, 150));

      // Parse tool calls from the text
      const toolCalls = this.parser.parseMessage(text);

      if (toolCalls.length > 0) {
        console.log(`[MCP Extension] Parsed ${toolCalls.length} tool call(s):`, toolCalls);

        // Mark as processed
        this.processedElements.add(codeElement);

        // Inject UI for each tool call
        toolCalls.forEach(toolCall => {
          this.injectExecutionUIAfterCodeBlock(toolCall, codeElement);
        });
      }
    });
  }

  /**
   * Inject execution UI after a code block
   */
  private injectExecutionUIAfterCodeBlock(toolCall: DetectedToolCall, codeElement: HTMLElement): void {
    // Find or create container after the code block
    const container = this.getOrCreateToolCallContainer(codeElement);

    // Create UI and inject
    this.injectExecutionUI(toolCall, container);
  }

  /**
   * Get or create container for tool call UI
   */
  private getOrCreateToolCallContainer(codeElement: HTMLElement): HTMLElement {
    // Check if container already exists
    const parentDiv = codeElement.closest('div[class*="group"]') || codeElement.parentElement;

    if (!parentDiv) {
      console.warn('[MCP Extension] Could not find parent for code block');
      return codeElement.parentElement || document.body;
    }

    let container = parentDiv.querySelector('.mcp-tool-calls-container') as HTMLElement;

    if (!container) {
      container = document.createElement('div');
      container.className = 'mcp-tool-calls-container';
      container.style.cssText = `
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      `;

      parentDiv.appendChild(container);
    }

    return container;
  }

  /**
   * Inject execution UI for a tool call
   */
  private async injectExecutionUI(toolCall: DetectedToolCall, messageElement: HTMLElement): Promise<void> {
    // Create container for tool UI
    const container = document.createElement('div');
    container.className = 'mcp-tool-call';
    container.style.cssText = `
      margin: 12px 0;
      padding: 12px;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
      border-left: 3px solid #667eea;
      border-radius: 6px;
    `;

    // Tool name header
    const header = document.createElement('div');
    header.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      color: #667eea;
      margin-bottom: 8px;
    `;
    header.textContent = `🔧 Tool Call: ${toolCall.toolName}`;

    container.appendChild(header);

    // Arguments display
    if (toolCall.arguments && Object.keys(toolCall.arguments).length > 0) {
      const argsDisplay = this.executor.createArgumentsDisplay(toolCall);
      container.appendChild(argsDisplay);
    }

    // Execute button or auto-execute indicator
    if (this.mcpSettings.autoExecute && this.mcpSettings.enabled) {
      // Auto-execute mode
      const autoExecuteIndicator = document.createElement('div');
      autoExecuteIndicator.style.cssText = `
        padding: 8px 12px;
        background: #dbeafe;
        border-radius: 6px;
        font-size: 13px;
        color: #1e40af;
        margin-top: 8px;
      `;
      autoExecuteIndicator.textContent = '⚡ Auto-executing...';
      container.appendChild(autoExecuteIndicator);

      // Append to message first
      messageElement.appendChild(container);

      // Execute automatically
      await this.executor.executeToolInContainer(toolCall, container);
    } else {
      // Manual execute mode
      const executeBtn = this.executor.createExecutionButton(toolCall, container);
      container.appendChild(executeBtn);

      // Append to message
      messageElement.appendChild(container);
    }
  }

  /**
   * Setup message listener for background updates
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message) => {
      switch (message.type) {
        case MessageType.MCP_STATUS_CHANGED:
          this.handleStatusChange(message.payload);
          break;

        case MessageType.MCP_TOOLS_UPDATED:
          this.handleToolsUpdate(message.payload);
          break;
      }
    });
  }

  /**
   * Handle connection status change
   */
  private handleStatusChange(status: ConnectionStatus): void {
    console.log('[MCP Extension] Status changed:', status);
    this.connectionStatus = status;

    const button = document.getElementById('mcp-toggle-button') as HTMLButtonElement;
    if (button) {
      this.updateButtonState(button);
    }
  }

  /**
   * Handle tools update
   */
  private handleToolsUpdate(payload: { tools: MCPTool[] }): void {
    console.log(`[MCP Extension] Tools updated: ${payload.tools.length} tools`);
    this.availableTools = payload.tools;
    this.modal.updateTools(this.availableTools);

    // Update sidebar if open
    if (this.sidebarOpen) {
      this.hideToolsSidebar();
      this.showToolsSidebar();
    }
  }
}

// Initialize extension when DOM is ready
if (ChatGPTAdapter.isChatGPT()) {
  console.log('[MCP Extension] ChatGPT detected, initializing...');

  const extension = new ChatGPTMCPExtension();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      extension.initialize();
    });
  } else {
    extension.initialize();
  }
} else {
  console.log('[MCP Extension] Not a ChatGPT page, skipping initialization');
}
