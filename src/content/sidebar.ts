/**
 * Enhanced MCP Sidebar
 * Provides a resizable sidebar with tabs for tools, settings, and connection management
 */

import { MCPTool, ConnectionStatus } from '../types';
import { generateMCPInstructions } from './instruction-generator';
import { ChatGPTAdapter } from './chatgpt-adapter';

export interface SidebarSettings {
  enabled: boolean;
  autoExecute: boolean;
  instructions: string;
  selectedTools: Set<string>;
}

export class MCPSidebar {
  private container: HTMLElement | null = null;
  private isMinimized: boolean = false;
  private currentWidth: number = 320;
  private MIN_WIDTH = 280;
  private MAX_WIDTH = 600;
  private currentTab: 'tools' | 'settings' | 'connection' | 'instructions' = 'tools';
  private tools: MCPTool[] = [];
  private selectedTools: Set<string> = new Set();
  private instructions: string = '';
  private customInstructions: string = '';
  private adapter: ChatGPTAdapter;
  private connectionStatus: ConnectionStatus = { isConnected: false };
  private isVisible: boolean = false;
  private isResizing: boolean = false;
  private onSettingsChange?: (settings: SidebarSettings) => void;
  private onToolSelectionChange?: () => void;

  constructor(
    adapter: ChatGPTAdapter,
    onSettingsChange?: (settings: SidebarSettings) => void,
    onToolSelectionChange?: () => void
  ) {
    this.adapter = adapter;
    this.onSettingsChange = onSettingsChange;
    this.onToolSelectionChange = onToolSelectionChange;
    this.loadSettings();
  }

  /**
   * Load saved settings
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(['sidebarWidth', 'selectedTools', 'mcpInstructions']);
      if (stored.sidebarWidth) {
        this.currentWidth = stored.sidebarWidth;
      }
      if (stored.selectedTools) {
        this.selectedTools = new Set(stored.selectedTools);
      }
      if (typeof stored.mcpInstructions === 'string') {
        this.customInstructions = stored.mcpInstructions;
      }
    } catch (error) {
      console.error('[Sidebar] Failed to load settings:', error);
    } finally {
      this.regenerateInstructions();
    }
  }

  /**
   * Save settings
   */
  private async saveSettings(): Promise<void> {
    try {
      await chrome.storage.local.set({
        sidebarWidth: this.currentWidth,
        selectedTools: Array.from(this.selectedTools)
      });
    } catch (error) {
      console.error('[Sidebar] Failed to save settings:', error);
    }
  }

  /**
   * Get selected tool objects
   */
  private getSelectedToolObjects(): MCPTool[] {
    if (this.selectedTools.size === 0) {
      return [];
    }
    const selected = new Set(this.selectedTools);
    return this.tools.filter(tool => selected.has(tool.name));
  }

  /**
   * Regenerate instructions based on current selections and custom instructions
   */
  private regenerateInstructions(): void {
    const selectedTools = this.getSelectedToolObjects();
    const newInstructions = selectedTools.length
      ? generateMCPInstructions(selectedTools, this.customInstructions)
      : this.tools.length > 0
        ? 'No tools selected. Choose tools from the Tools tab to generate instructions.'
        : generateMCPInstructions([], this.customInstructions);

    if (newInstructions === this.instructions) {
      return;
    }

    this.instructions = newInstructions;

    const shouldPersist = selectedTools.length > 0 || this.tools.length === 0;
    if (shouldPersist) {
      void chrome.storage.local
        .set({ mcpGeneratedInstructions: this.instructions })
        .catch(error => {
          console.error('[Sidebar] Failed to persist generated instructions:', error);
        });
    }
  }

  /**
   * Update tools
   */
  updateTools(tools: MCPTool[]): void {
    console.log('[Sidebar] Updating tools:', tools.length);
    this.tools = tools;
    const availableNames = new Set(tools.map(tool => tool.name));
    let selectionChanged = false;
    if (this.selectedTools.size > 0) {
      const filtered = Array.from(this.selectedTools).filter(name => availableNames.has(name));
      if (filtered.length !== this.selectedTools.size) {
        this.selectedTools = new Set(filtered);
        selectionChanged = true;
      }
    }
    // Select all tools by default if none selected
    if (this.selectedTools.size === 0 && tools.length > 0) {
      this.selectedTools = new Set(tools.map(tool => tool.name));
      selectionChanged = true;
    }
    if (selectionChanged) {
      this.saveSettings();
    }
    this.regenerateInstructions();
    // If sidebar is visible, re-render to show new tools
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.render();
  }

  /**
   * Show sidebar
   */
  show(): void {
    if (!this.container) {
      this.create();
    }
    if (this.container) {
      this.container.style.display = 'block';
      this.isVisible = true;
    }
  }

  /**
   * Hide sidebar
   */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Toggle sidebar visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Create sidebar UI
   */
  private create(): void {
    // Check if sidebar already exists
    let existing = document.getElementById('mcp-sidebar-container');
    if (existing) {
      this.container = existing;
      this.render();
      return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = 'mcp-sidebar-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: ${this.currentWidth}px;
      height: 100vh;
      background: white;
      box-shadow: -2px 0 8px rgba(0,0,0,0.15);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, sans-serif;
      transition: width 0.2s ease;
    `;

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 4px;
      height: 100%;
      cursor: ew-resize;
      background: transparent;
      transition: background 0.2s;
    `;
    resizeHandle.onmouseenter = () => {
      resizeHandle.style.background = 'rgba(102, 126, 234, 0.5)';
    };
    resizeHandle.onmouseleave = () => {
      if (!this.isResizing) {
        resizeHandle.style.background = 'transparent';
      }
    };

    this.setupResizeHandler(resizeHandle, container);
    container.appendChild(resizeHandle);

    // Header
    const header = this.createHeader();
    container.appendChild(header);

    // Tab navigation
    const tabNav = this.createTabNav();
    container.appendChild(tabNav);

    // Content area
    const content = document.createElement('div');
    content.id = 'mcp-sidebar-content';
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px;
      max-height: calc(100vh - 140px);
    `;
    container.appendChild(content);

    document.body.appendChild(container);
    this.container = container;
    this.render();
  }

  /**
   * Create header
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 2px solid #e5e7eb;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    `;

    const title = document.createElement('h2');
    title.textContent = 'MCP Tools';
    title.style.cssText = `
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    `;

    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Minimize button
    const minimizeBtn = document.createElement('button');
    minimizeBtn.innerHTML = this.isMinimized ? '→' : '←';
    minimizeBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      transition: background 0.2s;
    `;
    minimizeBtn.onmouseenter = () => {
      minimizeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    };
    minimizeBtn.onmouseleave = () => {
      minimizeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    };
    minimizeBtn.onclick = () => this.toggleMinimize();

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 18px;
      transition: background 0.2s;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    };
    closeBtn.onclick = () => this.hide();

    controls.appendChild(minimizeBtn);
    controls.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(controls);

    return header;
  }

  /**
   * Create tab navigation
   */
  private createTabNav(): HTMLElement {
    const nav = document.createElement('div');
    nav.style.cssText = `
      display: flex;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    `;

    const tabs = [
      { id: 'tools' as const, label: 'Tools', icon: '🔧' },
      { id: 'instructions' as const, label: 'Instructions', icon: '📘' },
      { id: 'settings' as const, label: 'Settings', icon: '⚙️' },
      { id: 'connection' as const, label: 'Connection', icon: '🔌' }
    ];

    tabs.forEach(tab => {
      const button = document.createElement('button');
      button.textContent = `${tab.icon} ${tab.label}`;
      button.style.cssText = `
        flex: 1;
        padding: 12px;
        border: none;
        background: ${this.currentTab === tab.id ? 'white' : 'transparent'};
        border-bottom: 2px solid ${this.currentTab === tab.id ? '#667eea' : 'transparent'};
        cursor: pointer;
        font-size: 14px;
        font-weight: ${this.currentTab === tab.id ? '600' : '400'};
        color: ${this.currentTab === tab.id ? '#667eea' : '#6b7280'};
        transition: all 0.2s;
      `;
      button.onclick = () => {
        this.currentTab = tab.id;
        this.render();
      };

      button.onmouseenter = () => {
        if (this.currentTab !== tab.id) {
          button.style.background = '#f3f4f6';
        }
      };

      button.onmouseleave = () => {
        if (this.currentTab !== tab.id) {
          button.style.background = 'transparent';
        }
      };

      nav.appendChild(button);
    });

    return nav;
  }

  /**
   * Render sidebar content based on current tab
   */
  private render(): void {
    const content = document.getElementById('mcp-sidebar-content');
    if (!content) return;

    content.innerHTML = '';

    if (this.currentTab === 'instructions') {
      this.regenerateInstructions();
    }

    switch (this.currentTab) {
      case 'tools':
        this.renderToolsTab(content);
        break;
      case 'instructions':
        this.renderInstructionsTab(content);
        break;
      case 'settings':
        this.renderSettingsTab(content);
        break;
      case 'connection':
        this.renderConnectionTab(content);
        break;
    }
  }

  /**
   * Render tools tab with checkboxes
   */
  private renderToolsTab(container: HTMLElement): void {
    // Tools count and select all
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    `;

    const count = document.createElement('div');
    count.textContent = `${this.selectedTools.size} / ${this.tools.length} selected`;
    count.style.cssText = `
      font-size: 14px;
      color: #6b7280;
      font-weight: 500;
    `;

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = this.selectedTools.size === this.tools.length ? 'Deselect All' : 'Select All';
    selectAllBtn.style.cssText = `
      padding: 6px 12px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    selectAllBtn.onmouseenter = () => {
      selectAllBtn.style.background = '#5568d3';
    };
    selectAllBtn.onmouseleave = () => {
      selectAllBtn.style.background = '#667eea';
    };
    selectAllBtn.onclick = () => {
      if (this.selectedTools.size === this.tools.length) {
        this.selectedTools.clear();
      } else {
        this.tools.forEach(tool => this.selectedTools.add(tool.name));
      }
      this.saveSettings();
      this.regenerateInstructions();
      this.notifySettingsChange();

      // Notify about tool selection change
      if (this.onToolSelectionChange) {
        this.onToolSelectionChange();
      }

      this.render();
    };

    toolbar.appendChild(count);
    toolbar.appendChild(selectAllBtn);
    container.appendChild(toolbar);

    // Tools list
    if (this.tools.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No tools available. Connect to a server first.';
      empty.style.cssText = `
        text-align: center;
        padding: 32px 16px;
        color: #9ca3af;
        font-size: 14px;
      `;
      container.appendChild(empty);
      return;
    }

    const toolsList = document.createElement('div');
    toolsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      max-height: calc(100vh - 250px);
      padding-right: 4px;
    `;

    this.tools.forEach(tool => {
      const toolCard = this.createToolCheckboxCard(tool);
      toolsList.appendChild(toolCard);
    });

    container.appendChild(toolsList);
  }

  /**
   * Render instructions tab
   */
  private renderInstructionsTab(container: HTMLElement): void {
    const selectedCount = this.getSelectedToolObjects().length;
    const totalCount = this.tools.length;

    const statusCard = document.createElement('div');
    statusCard.style.cssText = `
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      color: #4338ca;
      font-size: 13px;
      line-height: 1.5;
    `;
    statusCard.textContent = selectedCount
      ? `Generating instructions for ${selectedCount} of ${totalCount} available tools.`
      : 'Select tools from the Tools tab to include them in the generated instructions.';
    container.appendChild(statusCard);

    const actionsRow = document.createElement('div');
    actionsRow.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    `;

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy Instructions';
    copyButton.style.cssText = `
      flex: 1;
      padding: 10px 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    `;
    copyButton.onmouseenter = () => (copyButton.style.opacity = '0.85');
    copyButton.onmouseleave = () => (copyButton.style.opacity = '1');
    copyButton.onclick = () => this.handleCopyInstructions(copyButton);

    const insertButton = document.createElement('button');
    insertButton.textContent = 'Insert into Chat';
    insertButton.style.cssText = `
      flex: 1;
      padding: 10px 14px;
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    `;
    insertButton.onmouseenter = () => (insertButton.style.opacity = '0.85');
    insertButton.onmouseleave = () => (insertButton.style.opacity = '1');
    insertButton.onclick = () => this.handleInsertInstructions(insertButton);

    const disableActions = !this.instructions?.trim() || selectedCount === 0;
    if (disableActions) {
      copyButton.disabled = true;
      insertButton.disabled = true;
      copyButton.style.opacity = '0.6';
      insertButton.style.opacity = '0.6';
      copyButton.style.cursor = 'not-allowed';
      insertButton.style.cursor = 'not-allowed';
    }

    actionsRow.appendChild(copyButton);
    actionsRow.appendChild(insertButton);
    container.appendChild(actionsRow);

    const infoText = document.createElement('div');
    infoText.style.cssText = `
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 8px;
      line-height: 1.5;
    `;
    infoText.textContent = 'These instructions include the required XML function-call format and the selected tools with their schemas.';
    container.appendChild(infoText);

    const instructionsWrapper = document.createElement('div');
    instructionsWrapper.style.cssText = `
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      max-height: calc(100vh - 260px);
      overflow-y: auto;
    `;

    const instructionsPre = document.createElement('pre');
    instructionsPre.style.cssText = `
      margin: 0;
      font-size: 12px;
      line-height: 1.6;
      color: #1f2937;
      font-family: ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      white-space: pre-wrap;
      word-break: break-word;
    `;
    instructionsPre.textContent = this.instructions || 'Instructions will appear once tools are selected.';

    instructionsWrapper.appendChild(instructionsPre);
    container.appendChild(instructionsWrapper);

    if (this.customInstructions.trim()) {
      const customBlock = document.createElement('div');
      customBlock.style.cssText = `
        margin-top: 12px;
        padding: 10px;
        background: #fff7ed;
        border: 1px solid #fdba74;
        border-radius: 6px;
        font-size: 12px;
        color: #9a3412;
        white-space: pre-wrap;
        word-break: break-word;
      `;
      customBlock.innerHTML = `<strong>Custom instructions:</strong>\n${this.customInstructions}`;
      container.appendChild(customBlock);
    }
  }

  /**
   * Copy instructions to clipboard
   */
  private async handleCopyInstructions(button: HTMLButtonElement): Promise<void> {
    if (!this.instructions?.trim()) {
      return;
    }

    const originalText = button.textContent ?? 'Copy Instructions';
    button.textContent = 'Copying...';
    button.style.opacity = '0.7';

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(this.instructions);
      button.textContent = 'Copied!';
      button.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
    } catch (error) {
      console.error('[Sidebar] Failed to copy instructions:', error);
      button.textContent = 'Copy failed';
      button.style.background = 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)';
    } finally {
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        button.style.opacity = '1';
      }, 1800);
    }
  }

  /**
   * Insert instructions into ChatGPT input
   */
  private handleInsertInstructions(button: HTMLButtonElement): void {
    if (!this.instructions?.trim()) {
      return;
    }

    const originalText = button.textContent ?? 'Insert into Chat';
    button.textContent = 'Inserting...';
    button.style.opacity = '0.7';

    try {
      const success = this.adapter.insertText(this.instructions);
      if (success) {
        button.textContent = 'Inserted!';
        button.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
      } else {
        throw new Error('Failed to insert text');
      }
    } catch (error) {
      console.error('[Sidebar] Failed to insert instructions:', error);
      button.textContent = 'Insert failed';
      button.style.background = 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)';
    } finally {
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
        button.style.opacity = '1';
      }, 1800);
    }
  }

  /**
   * Create tool card with checkbox
   */
  private createToolCheckboxCard(tool: MCPTool): HTMLElement {
    const isSelected = this.selectedTools.has(tool.name);

    const card = document.createElement('label');
    card.style.cssText = `
      display: flex;
      align-items: start;
      padding: 12px;
      background: ${isSelected ? '#f0f4ff' : '#f9fafb'};
      border: 1px solid ${isSelected ? '#667eea' : '#e5e7eb'};
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    card.onmouseenter = () => {
      card.style.background = isSelected ? '#e8f0fe' : '#f3f4f6';
      card.style.borderColor = '#667eea';
    };

    card.onmouseleave = () => {
      card.style.background = isSelected ? '#f0f4ff' : '#f9fafb';
      card.style.borderColor = isSelected ? '#667eea' : '#e5e7eb';
    };

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isSelected;
    checkbox.style.cssText = `
      width: 18px;
      height: 18px;
      margin-right: 12px;
      margin-top: 2px;
      cursor: pointer;
      accent-color: #667eea;
      flex-shrink: 0;
    `;

    checkbox.onchange = () => {
      if (checkbox.checked) {
        this.selectedTools.add(tool.name);
      } else {
        this.selectedTools.delete(tool.name);
      }
      this.saveSettings();
      this.regenerateInstructions();
      this.notifySettingsChange();

      // Notify about tool selection change
      if (this.onToolSelectionChange) {
        this.onToolSelectionChange();
      }

      this.render();
    };

    // Tool info
    const info = document.createElement('div');
    info.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    const name = document.createElement('div');
    name.textContent = tool.name;
    name.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      color: #111827;
      margin-bottom: 4px;
      word-break: break-word;
    `;

    const description = document.createElement('div');
    description.textContent = tool.description || 'No description';
    description.style.cssText = `
      font-size: 12px;
      color: #6b7280;
      line-height: 1.4;
      word-break: break-word;
    `;

    info.appendChild(name);
    info.appendChild(description);

    card.appendChild(checkbox);
    card.appendChild(info);

    return card;
  }

  /**
   * Render settings tab
   */
  private renderSettingsTab(container: HTMLElement): void {
    const section = document.createElement('div');

    const statusCard = document.createElement('div');
    statusCard.style.cssText = `
      background: ${this.connectionStatus.isConnected ? '#d1fae5' : '#fee2e2'};
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      border: 1px solid ${this.connectionStatus.isConnected ? '#10b981' : '#ef4444'};
    `;

    const statusText = document.createElement('div');
    statusText.textContent = this.connectionStatus.isConnected
      ? `✓ Connected via ${this.connectionStatus.transport}`
      : '✗ Disconnected';
    statusText.style.cssText = `
      font-weight: 600;
      font-size: 15px;
      color: ${this.connectionStatus.isConnected ? '#065f46' : '#991b1b'};
      margin-bottom: 8px;
    `;

    const toolCount = document.createElement('div');
    toolCount.textContent = `Available Tools: ${this.tools.length}`;
    toolCount.style.cssText = `
      font-size: 13px;
      color: ${this.connectionStatus.isConnected ? '#047857' : '#b91c1c'};
    `;

    statusCard.appendChild(statusText);
    statusCard.appendChild(toolCount);
    container.appendChild(statusCard);

    section.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">
        Connection Settings
      </h3>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">
            Proxy URL
          </label>
          <input
            type="text"
            id="sidebar-proxy-url"
            placeholder="ws://localhost:3006/message"
            style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; background: white; color: #111827;"
          />
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">
            Transport Type
          </label>
          <select
            id="sidebar-transport-type"
            style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; cursor: pointer; background: white; color: #111827;"
          >
            <option value="websocket">WebSocket (ws://)</option>
            <option value="sse">SSE (http:// or https://)</option>
            <option value="streamable-http">Streamable HTTP</option>
          </select>
        </div>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 16px;">
        <button
          id="sidebar-connect-btn"
          style="flex: 1; padding: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;"
        >
          ${this.connectionStatus.isConnected ? '🔌 Reconnect' : '🔌 Connect'}
        </button>
        ${this.connectionStatus.isConnected ? `
        <button
          id="sidebar-disconnect-btn"
          style="flex: 1; padding: 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;"
        >
          ✕ Disconnect
        </button>
        ` : ''}
      </div>
    `;

    container.appendChild(section);

    // Load current settings
    chrome.storage.local.get(['proxyUrl', 'transportType'], (data) => {
      const urlInput = document.getElementById('sidebar-proxy-url') as HTMLInputElement;
      const typeSelect = document.getElementById('sidebar-transport-type') as HTMLSelectElement;

      if (urlInput && data.proxyUrl) {
        urlInput.value = data.proxyUrl;
      }
      if (typeSelect && data.transportType) {
        typeSelect.value = data.transportType;
      }
    });

    // Setup event handlers
    const connectBtn = document.getElementById('sidebar-connect-btn');
    const disconnectBtn = document.getElementById('sidebar-disconnect-btn');

    if (connectBtn) {
      connectBtn.onclick = async () => {
        const urlInput = document.getElementById('sidebar-proxy-url') as HTMLInputElement;
        const typeSelect = document.getElementById('sidebar-transport-type') as HTMLSelectElement;

        const uri = urlInput?.value || '';
        const type = typeSelect?.value || 'websocket';

        if (!uri) {
          alert('Please enter a proxy URL');
          return;
        }

        connectBtn.textContent = '🔄 Connecting...';
        connectBtn.style.opacity = '0.6';

        try {
          // Save settings first
          await chrome.storage.local.set({ proxyUrl: uri, transportType: type });

          // Send connect message
          const response = await chrome.runtime.sendMessage({
            type: 'MCP_CONNECT',
            payload: { uri, type }
          });

          if (response.success) {
            connectBtn.textContent = '✓ Connected!';
            setTimeout(() => {
              this.render();
            }, 1000);
          } else {
            connectBtn.textContent = '✗ Failed';
            alert(`Connection failed: ${response.error}`);
            setTimeout(() => {
              connectBtn.textContent = '🔌 Connect';
            }, 2000);
          }
        } catch (error: any) {
          connectBtn.textContent = '✗ Error';
          alert(`Connection error: ${error.message}`);
          setTimeout(() => {
            connectBtn.textContent = '🔌 Connect';
          }, 2000);
        } finally {
          connectBtn.style.opacity = '1';
        }
      };
    }

    if (disconnectBtn) {
      disconnectBtn.onclick = async () => {
        disconnectBtn.textContent = '🔄 Disconnecting...';
        disconnectBtn.style.opacity = '0.6';

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'MCP_DISCONNECT'
          });

          if (response.success) {
            setTimeout(() => {
              this.render();
            }, 500);
          } else {
            alert(`Disconnection failed: ${response.error}`);
          }
        } catch (error: any) {
          alert(`Disconnection error: ${error.message}`);
        }
      };
    }
  }

  /**
   * Render connection tab
   */
  private renderConnectionTab(container: HTMLElement): void {
    const statusCard = document.createElement('div');
    statusCard.style.cssText = `
      background: ${this.connectionStatus.isConnected ? '#d1fae5' : '#fee2e2'};
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      border: 1px solid ${this.connectionStatus.isConnected ? '#10b981' : '#ef4444'};
    `;

    const statusText = document.createElement('div');
    statusText.textContent = this.connectionStatus.isConnected
      ? `✓ Connected via ${this.connectionStatus.transport}`
      : '✗ Disconnected';
    statusText.style.cssText = `
      font-weight: 600;
      font-size: 15px;
      color: ${this.connectionStatus.isConnected ? '#065f46' : '#991b1b'};
      margin-bottom: 8px;
    `;

    const toolCount = document.createElement('div');
    toolCount.textContent = `Available Tools: ${this.tools.length}`;
    toolCount.style.cssText = `
      font-size: 13px;
      color: ${this.connectionStatus.isConnected ? '#047857' : '#b91c1c'};
    `;

    statusCard.appendChild(statusText);
    statusCard.appendChild(toolCount);
    container.appendChild(statusCard);

    // Connection info
    if (this.connectionStatus.isConnected && this.connectionStatus.transport) {
      const info = document.createElement('div');
      info.style.cssText = `
        background: #f9fafb;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      `;

      info.innerHTML = `
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #111827;">
          Connection Details
        </h4>
        <div style="font-size: 13px; color: #6b7280; line-height: 1.8;">
          <div><strong>Transport:</strong> ${this.connectionStatus.transport}</div>
          <div><strong>Selected Tools:</strong> ${this.selectedTools.size} / ${this.tools.length}</div>
        </div>
      `;

      container.appendChild(info);
    }
  }

  /**
   * Setup resize handler
   */
  private setupResizeHandler(handle: HTMLElement, container: HTMLElement): void {
    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;

      const delta = startX - e.clientX;
      const newWidth = Math.min(this.MAX_WIDTH, Math.max(this.MIN_WIDTH, startWidth + delta));

      this.currentWidth = newWidth;
      container.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      this.isResizing = false;
      handle.style.background = 'transparent';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.saveSettings();
    };

    handle.onmousedown = (e) => {
      e.preventDefault();
      this.isResizing = true;
      startX = e.clientX;
      startWidth = this.currentWidth;
      handle.style.background = 'rgba(102, 126, 234, 0.5)';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  }

  /**
   * Toggle minimize
   */
  private toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    if (this.container) {
      this.container.style.width = this.isMinimized ? '56px' : `${this.currentWidth}px`;
    }
  }

  /**
   * Get selected tools
   */
  getSelectedTools(): string[] {
    return Array.from(this.selectedTools);
  }

  /**
   * Notify settings change
   */
  private notifySettingsChange(): void {
    if (this.onSettingsChange) {
      chrome.storage.local.get(['mcpEnabled', 'mcpAutoExecute', 'mcpInstructions'], (data) => {
        const storedCustomInstructions = typeof data.mcpInstructions === 'string' ? data.mcpInstructions : '';
        if (storedCustomInstructions !== this.customInstructions) {
          this.customInstructions = storedCustomInstructions;
          this.regenerateInstructions();
        }
        this.onSettingsChange!({
          enabled: data.mcpEnabled ?? false,
          autoExecute: data.mcpAutoExecute ?? false,
          instructions: storedCustomInstructions,
          selectedTools: this.selectedTools
        });
      });
    }
  }

  /**
   * Update custom instructions from external sources
   */
  updateCustomInstructions(instructions: string): void {
    const normalized = instructions ?? '';
    if (normalized === this.customInstructions) {
      return;
    }
    this.customInstructions = normalized;
    this.regenerateInstructions();
    if (this.isVisible && this.currentTab === 'instructions') {
      this.render();
    }
  }

  /**
   * Get visibility state
   */
  isVisibleState(): boolean {
    return this.isVisible;
  }
}
