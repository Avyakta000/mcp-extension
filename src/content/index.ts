import { ChatGPTAdapter } from './chatgpt-adapter';
import { ToolCallParser } from './tool-parser';
import { ToolExecutor } from './tool-executor';
import { MCPModal, MCPSettings } from './mcp-modal';
import { MCPSidebar, SidebarSettings } from './sidebar';
import { MessageType, ConnectionStatus, MCPTool, DetectedToolCall } from '../types';

class ChatGPTMCPExtension {
  private adapter: ChatGPTAdapter;
  private parser: ToolCallParser;
  private executor: ToolExecutor;
  private modal: MCPModal;
  private sidebar: MCPSidebar;
  private connectionStatus: ConnectionStatus = { isConnected: false };
  private availableTools: MCPTool[] = [];
  private processedElements = new WeakSet<HTMLElement>();
  private observer: MutationObserver | null = null;
  private mcpSettings: MCPSettings = {
    enabled: false,
    autoExecute: false,
    instructions: ''
  };
  private mcpButton: HTMLButtonElement | null = null;
  private lastUrl: string = '';
  private urlCheckInterval: number | null = null;

  constructor() {
    this.adapter = new ChatGPTAdapter();
    this.parser = new ToolCallParser();
    this.executor = new ToolExecutor(this.adapter);

    // Initialize sidebar first
    this.sidebar = new MCPSidebar(
      this.adapter,
      (settings) => this.handleSidebarSettingsChange(settings),
      () => this.handleToolSelectionChange()
    );

    // Initialize modal with sidebar toggle callback
    this.modal = new MCPModal(
      this.adapter,
      (enabled) => this.handleSidebarToggle(enabled),
      (settings) => this.handleSettingsChange(settings),
      () => this.sidebar.getSelectedTools()
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
      console.error('[MCP Extension] ChatGPT interface not ready, retrying...');
      // Retry after a delay
      setTimeout(() => this.initialize(), 2000);
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

    // Start monitoring URL changes (for new chats)
    this.startUrlMonitoring();

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

      // Don't auto-open sidebar on load
      // User will manually toggle sidebar using the button
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
        this.sidebar.updateConnectionStatus(this.connectionStatus);
        this.updateButtonState();
        console.log('[MCP Extension] Connection status:', this.connectionStatus);
      }

      // Auto-connect if not connected
      if (!this.connectionStatus.isConnected) {
        console.log('[MCP Extension] Not connected, attempting auto-connect...');
        const connectResponse = await chrome.runtime.sendMessage({
          type: MessageType.MCP_CONNECT
        });

        if (connectResponse.success) {
          this.connectionStatus = connectResponse.data;
          this.sidebar.updateConnectionStatus(this.connectionStatus);
          this.updateButtonState();
          console.log('[MCP Extension] Auto-connect successful:', this.connectionStatus);
        } else {
          console.warn('[MCP Extension] Auto-connect failed:', connectResponse.error);
        }
      }

      // Get available tools
      const toolsResponse = await chrome.runtime.sendMessage({
        type: MessageType.MCP_LIST_TOOLS
      });

      if (toolsResponse.success && toolsResponse.data?.tools) {
        this.availableTools = toolsResponse.data.tools;
        this.modal.updateTools(this.availableTools);
        this.sidebar.updateTools(this.availableTools);
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
      this.mcpButton = button;
      this.updateButtonState();
      console.log('[MCP Extension] MCP button created');
    }
  }

  /**
   * Handle sidebar toggle from modal
   */
  private handleSidebarToggle(enabled: boolean): void {
    console.log('[MCP Extension] Sidebar toggle:', enabled);

    if (enabled) {
      this.sidebar.show();
    } else {
      this.sidebar.hide();
    }

    this.updateButtonHighlight();
  }

  /**
   * Handle sidebar settings change
   */
  private handleSidebarSettingsChange(settings: SidebarSettings): void {
    console.log('[MCP Extension] Sidebar settings changed:', settings);
    this.mcpSettings.enabled = settings.enabled;
    this.mcpSettings.autoExecute = settings.autoExecute;
    this.mcpSettings.instructions = settings.instructions;

    this.updateButtonHighlight();
  }

  /**
   * Handle tool selection change in sidebar
   */
  private handleToolSelectionChange(): void {
    console.log('[MCP Extension] Tool selection changed');
    // Refresh modal preview if it's open
    this.modal.refreshPreview();
  }

  /**
   * Handle settings change from modal
   */
  private handleSettingsChange(settings: MCPSettings): void {
    console.log('[MCP Extension] Settings changed:', settings);
    this.mcpSettings = settings;
    this.sidebar.updateCustomInstructions(settings.instructions);
    this.modal.refreshPreview();

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
   * Update button state based on connection and MCP enabled status
   */
  private updateButtonState(): void {
    if (!this.mcpButton) return;

    const isEnabled = this.sidebar.isVisibleState();

    if (this.connectionStatus.isConnected) {
      // Connected - show gradient with highlighting if enabled
      if (isEnabled) {
        this.mcpButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        this.mcpButton.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.3), 0 4px 8px rgba(0,0,0,0.2)';
        this.mcpButton.style.transform = 'scale(1.05)';
      } else {
        this.mcpButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        this.mcpButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        this.mcpButton.style.transform = 'scale(1)';
      }
      this.mcpButton.title = `MCP Tools (Connected via ${this.connectionStatus.transport})${isEnabled ? ' - Active' : ''}`;
    } else {
      // Disconnected
      this.mcpButton.style.background = 'linear-gradient(135deg, #bbb 0%, #888 100%)';
      this.mcpButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      this.mcpButton.style.transform = 'scale(1)';
      this.mcpButton.title = 'MCP Tools (Disconnected)';
    }

    // Add transition for smooth animation
    this.mcpButton.style.transition = 'all 0.3s ease';
  }

  /**
   * Update button highlight based on sidebar visibility
   */
  private updateButtonHighlight(): void {
    this.updateButtonState();
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

        // Mark as processed FIRST to prevent duplicate processing
        this.processedElements.add(codeElement);

        // Hide the XML code block
        this.hideXMLCodeBlock(codeElement);

        // Inject UI for each tool call
        toolCalls.forEach(toolCall => {
          this.injectExecutionUIAfterCodeBlock(toolCall, codeElement);
        });
      }
    });
  }

  /**
   * Hide the XML code block containing function calls
   */
  private hideXMLCodeBlock(codeElement: HTMLElement): void {
    // Find the parent <pre> or code container
    const preElement = codeElement.closest('pre');

    if (preElement) {
      // Hide the entire pre block
      preElement.style.display = 'none';
    } else if (codeElement.tagName === 'PRE') {
      // If the element itself is a pre
      codeElement.style.display = 'none';
    } else {
      // Fallback - hide the code element itself
      codeElement.style.display = 'none';
    }
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
    if (this.mcpSettings.autoExecute && this.mcpSettings.enabled && this.connectionStatus.isConnected) {
      // Auto-execute mode - only if connected
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
    } else if (this.mcpSettings.autoExecute && this.mcpSettings.enabled && !this.connectionStatus.isConnected) {
      // Auto-execute enabled but not connected
      const warningDiv = document.createElement('div');
      warningDiv.style.cssText = `
        padding: 8px 12px;
        background: #fef3c7;
        border-radius: 6px;
        font-size: 13px;
        color: #92400e;
        margin-top: 8px;
      `;
      warningDiv.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">⚠️ Not Connected</div>
        <div>MCP server is not connected. Click execute manually or check connection.</div>
      `;
      container.appendChild(warningDiv);

      // Also add manual execute button
      const executeBtn = this.executor.createExecutionButton(toolCall, container);
      container.appendChild(executeBtn);

      // Append to message
      messageElement.appendChild(container);
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
    this.sidebar.updateConnectionStatus(status);
    this.updateButtonState();
  }

  /**
   * Handle tools update
   */
  private handleToolsUpdate(payload: { tools: MCPTool[] }): void {
    console.log(`[MCP Extension] Tools updated: ${payload.tools.length} tools`);
    this.availableTools = payload.tools;
    this.modal.updateTools(this.availableTools);
    this.sidebar.updateTools(this.availableTools);
  }

  /**
   * Start monitoring URL changes to detect new chats
   */
  private startUrlMonitoring(): void {
    this.lastUrl = window.location.href;

    this.urlCheckInterval = window.setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl) {
        console.log('[MCP Extension] URL changed:', currentUrl);
        this.lastUrl = currentUrl;

        // Recreate button after URL change with delay for page to settle
        setTimeout(() => {
          this.createMCPButton();
        }, 1500);
      }
    }, 1000);

    console.log('[MCP Extension] URL monitoring started');
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
