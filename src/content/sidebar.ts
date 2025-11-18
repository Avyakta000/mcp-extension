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
      background: #000000;
      border-left: 1px solid #333333;
      box-shadow: -4px 0 24px rgba(0,0,0,0.5);
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
      resizeHandle.style.background = 'rgba(255, 255, 255, 0.2)';
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
      padding: 20px;
      border-bottom: 1px solid #222222;
      background: #000000;
      color: #ffffff;
    `;

    const title = document.createElement('h2');
    title.id = 'mcp-sidebar-title';
    title.textContent = 'MCP TOOLS';
    title.style.cssText = `
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #ffffff;
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
      background: transparent;
      border: 1px solid #333333;
      color: #ffffff;
      width: 32px;
      height: 32px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    `;
    minimizeBtn.onmouseenter = () => {
      minimizeBtn.style.background = '#ffffff';
      minimizeBtn.style.color = '#000000';
      minimizeBtn.style.borderColor = '#ffffff';
    };
    minimizeBtn.onmouseleave = () => {
      minimizeBtn.style.background = 'transparent';
      minimizeBtn.style.color = '#ffffff';
      minimizeBtn.style.borderColor = '#333333';
    };
    minimizeBtn.onclick = () => this.toggleMinimize();

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: transparent;
      border: 1px solid #333333;
      color: #ffffff;
      width: 32px;
      height: 32px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 18px;
      transition: all 0.2s;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.background = '#ffffff';
      closeBtn.style.color = '#000000';
      closeBtn.style.borderColor = '#ffffff';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = '#ffffff';
      closeBtn.style.borderColor = '#333333';
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
    nav.id = 'mcp-sidebar-tabnav';
    nav.style.cssText = `
      display: flex;
      border-bottom: 1px solid #222222;
      background: #000000;
    `;

    const tabs = [
      { id: 'tools' as const, label: 'TOOLS' },
      { id: 'instructions' as const, label: 'INSTRUCTIONS' },
      { id: 'settings' as const, label: 'SETTINGS' }
    ];

    tabs.forEach(tab => {
      const button = document.createElement('button');
      button.textContent = tab.label;
      button.style.cssText = `
        flex: 1;
        padding: 14px;
        border: none;
        background: transparent;
        border-bottom: 2px solid ${this.currentTab === tab.id ? '#ffffff' : 'transparent'};
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1px;
        color: ${this.currentTab === tab.id ? '#ffffff' : '#666666'};
        transition: all 0.2s;
      `;
      button.onclick = () => {
        this.currentTab = tab.id;
        this.render();
      };

      button.onmouseenter = () => {
        button.style.color = '#ffffff';
      };

      button.onmouseleave = () => {
        if (this.currentTab !== tab.id) {
          button.style.color = '#666666';
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
      border-bottom: 1px solid #222222;
    `;

    const count = document.createElement('div');
    count.textContent = `${this.selectedTools.size} / ${this.tools.length} selected`;
    count.style.cssText = `
      font-size: 14px;
      color: #999999;
      font-weight: 500;
    `;

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = this.selectedTools.size === this.tools.length ? 'Deselect All' : 'Select All';
    selectAllBtn.style.cssText = `
      padding: 6px 12px;
      background: #ffffff;
      color: #000000;
      border: 1px solid #000000;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    `;
    selectAllBtn.onmouseenter = () => {
      selectAllBtn.style.background = '#000000';
      selectAllBtn.style.color = '#ffffff';
    };
    selectAllBtn.onmouseleave = () => {
      selectAllBtn.style.background = '#ffffff';
      selectAllBtn.style.color = '#000000';
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
        color: #666666;
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
      background: #1a1a1a;
      border: 1px solid #333333;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      color: #ffffff;
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
      background: #ffffff;
      color: #000000;
      border: 1px solid #000000;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    copyButton.onmouseenter = () => {
      copyButton.style.background = '#000000';
      copyButton.style.color = '#ffffff';
    };
    copyButton.onmouseleave = () => {
      copyButton.style.background = '#ffffff';
      copyButton.style.color = '#000000';
    };
    copyButton.onclick = () => this.handleCopyInstructions(copyButton);

    const insertButton = document.createElement('button');
    insertButton.textContent = 'Insert into Chat';
    insertButton.style.cssText = `
      flex: 1;
      padding: 10px 14px;
      background: #000000;
      color: #ffffff;
      border: 1px solid #000000;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    insertButton.onmouseenter = () => {
      insertButton.style.background = '#333333';
    };
    insertButton.onmouseleave = () => {
      insertButton.style.background = '#000000';
    };
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

    // Collapsible instructions section
    const collapsibleHeader = document.createElement('div');
    collapsibleHeader.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: #111111;
      border: 1px solid #222222;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 0;
    `;

    const headerTitle = document.createElement('div');
    headerTitle.style.cssText = `
      font-size: 14px;
      color: #ffffff;
      font-weight: 600;
    `;
    headerTitle.textContent = '📄 Instructions Preview';

    const headerIcon = document.createElement('div');
    headerIcon.textContent = '▼';
    headerIcon.style.cssText = `
      color: #666666;
      font-size: 10px;
      transition: transform 0.2s;
    `;

    collapsibleHeader.appendChild(headerTitle);
    collapsibleHeader.appendChild(headerIcon);

    const instructionsWrapper = document.createElement('div');
    instructionsWrapper.style.cssText = `
      display: none;
      background: #0a0a0a;
      border: 1px solid #222222;
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 12px;
      margin-top: -1px;
    `;

    const instructionsPre = document.createElement('pre');
    instructionsPre.style.cssText = `
      margin: 0;
      font-size: 11px;
      line-height: 1.6;
      color: #cccccc;
      font-family: ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      white-space: pre-wrap;
      word-break: break-word;
    `;
    instructionsPre.textContent = this.instructions || 'Instructions will appear once tools are selected.';

    instructionsWrapper.appendChild(instructionsPre);

    // Toggle functionality
    let isExpanded = false;
    collapsibleHeader.onclick = () => {
      isExpanded = !isExpanded;
      instructionsWrapper.style.display = isExpanded ? 'block' : 'none';
      headerIcon.textContent = isExpanded ? '▲' : '▼';
      collapsibleHeader.style.borderRadius = isExpanded ? '8px 8px 0 0' : '8px';
    };

    collapsibleHeader.onmouseenter = () => {
      collapsibleHeader.style.background = '#1a1a1a';
      collapsibleHeader.style.borderColor = '#333333';
    };
    collapsibleHeader.onmouseleave = () => {
      collapsibleHeader.style.background = '#111111';
      collapsibleHeader.style.borderColor = '#222222';
    };

    container.appendChild(collapsibleHeader);
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
      button.style.background = 'linear-gradient(135deg, #ffffff 0%, #ffffff 100%)';
    } catch (error) {
      console.error('[Sidebar] Failed to copy instructions:', error);
      button.textContent = 'Copy failed';
      button.style.background = 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)';
    } finally {
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = 'linear-gradient(135deg, #ffffff 0%, #ffffff 100%)';
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
        button.style.background = 'linear-gradient(135deg, #ffffff 0%, #ffffff 100%)';
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
      background: ${isSelected ? '#ffffff' : '#0a0a0a'};
      border: 1px solid ${isSelected ? '#000000' : '#333333'};
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    card.onmouseenter = () => {
      card.style.background = isSelected ? '#f5f5f5' : '#1a1a1a';
      card.style.borderColor = isSelected ? '#000000' : '#555555';
    };

    card.onmouseleave = () => {
      card.style.background = isSelected ? '#ffffff' : '#0a0a0a';
      card.style.borderColor = isSelected ? '#000000' : '#333333';
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
      accent-color: #000000;
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
      color: ${isSelected ? '#000000' : '#ffffff'};
      margin-bottom: 4px;
      word-break: break-word;
    `;

    const description = document.createElement('div');
    description.textContent = tool.description || 'No description';
    description.style.cssText = `
      font-size: 12px;
      color: ${isSelected ? '#666666' : '#999999'};
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

    // Connection Info Button
    const infoHeader = document.createElement('div');
    infoHeader.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding: 12px;
      background: #111111;
      border: 1px solid #222222;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    const infoTitle = document.createElement('div');
    infoTitle.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
    `;
    infoTitle.innerHTML = `<span style="font-size: 14px;">ⓘ</span> CONNECTION INFO`;

    const infoIcon = document.createElement('span');
    infoIcon.textContent = '▼';
    infoIcon.style.cssText = `
      color: #666666;
      font-size: 10px;
      transition: transform 0.2s;
    `;

    infoHeader.appendChild(infoTitle);
    infoHeader.appendChild(infoIcon);

    // Expandable connection info content
    const infoContent = document.createElement('div');
    infoContent.style.cssText = `
      display: none;
      padding: 16px;
      background: #0a0a0a;
      border: 1px solid #222222;
      border-top: none;
      border-radius: 0 0 4px 4px;
      margin-top: -1px;
      margin-bottom: 16px;
    `;

    // Helper to format timestamp
    const formatTimestamp = (timestamp?: number): string => {
      if (!timestamp) return 'N/A';
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    const statusText = document.createElement('div');
    statusText.innerHTML = `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; color: #666666; margin-bottom: 4px; letter-spacing: 1px;">STATUS</div>
        <div style="font-size: 13px; color: ${this.connectionStatus.isConnected ? '#ffffff' : '#666666'}; font-weight: 500;">
          ${this.connectionStatus.isConnected ? '● CONNECTED' : '○ DISCONNECTED'}
        </div>
      </div>
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; color: #666666; margin-bottom: 4px; letter-spacing: 1px;">TRANSPORT</div>
        <div style="font-size: 13px; color: #ffffff; font-weight: 500;">
          ${this.connectionStatus.transport || 'N/A'}
        </div>
      </div>
      ${this.connectionStatus.connectedAt ? `
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; color: #666666; margin-bottom: 4px; letter-spacing: 1px;">CONNECTED AT</div>
          <div style="font-size: 13px; color: #ffffff; font-weight: 500;">
            ${formatTimestamp(this.connectionStatus.connectedAt)}
          </div>
        </div>
      ` : ''}
      ${this.connectionStatus.lastReconnectedAt ? `
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; color: #666666; margin-bottom: 4px; letter-spacing: 1px;">LAST RECONNECTED</div>
          <div style="font-size: 13px; color: #ffffff; font-weight: 500;">
            ${formatTimestamp(this.connectionStatus.lastReconnectedAt)}
          </div>
        </div>
      ` : ''}
      <div>
        <div style="font-size: 11px; color: #666666; margin-bottom: 4px; letter-spacing: 1px;">AVAILABLE TOOLS</div>
        <div style="font-size: 13px; color: #ffffff; font-weight: 500;">
          ${this.tools.length}
        </div>
      </div>
    `;

    infoContent.appendChild(statusText);

    // Toggle expandable section
    let isExpanded = false;
    infoHeader.onclick = () => {
      isExpanded = !isExpanded;
      infoContent.style.display = isExpanded ? 'block' : 'none';
      infoIcon.textContent = isExpanded ? '▲' : '▼';
      infoHeader.style.borderRadius = isExpanded ? '4px 4px 0 0' : '4px';
    };

    infoHeader.onmouseenter = () => {
      infoHeader.style.background = '#1a1a1a';
      infoHeader.style.borderColor = '#333333';
    };
    infoHeader.onmouseleave = () => {
      infoHeader.style.background = '#111111';
      infoHeader.style.borderColor = '#222222';
    };

    container.appendChild(infoHeader);
    container.appendChild(infoContent);

    section.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
        Connection Settings
      </h3>
      <div style="background: #0a0a0a; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #222222;">
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #cccccc; margin-bottom: 6px;">
            Proxy URL
          </label>
          <input
            type="text"
            id="sidebar-proxy-url"
            placeholder="ws://localhost:3006/message"
            style="width: 100%; padding: 8px 12px; border: 1px solid #333333; border-radius: 6px; font-size: 14px; box-sizing: border-box; background: #000000; color: #ffffff;"
          />
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #cccccc; margin-bottom: 6px;">
            Transport Type
          </label>
          <select
            id="sidebar-transport-type"
            style="width: 100%; padding: 8px 12px; border: 1px solid #333333; border-radius: 6px; font-size: 14px; box-sizing: border-box; cursor: pointer; background: #000000; color: #ffffff;"
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
          style="flex: 1; padding: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;"
        >
          ${this.connectionStatus.isConnected ? '🔌 Reconnect' : '🔌 Connect'}
        </button>
        ${this.connectionStatus.isConnected ? `
        <button
          id="sidebar-disconnect-btn"
          style="flex: 1; padding: 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;"
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
        background: #0a0a0a;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #222222;
      `;

      info.innerHTML = `
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #111827;">
          Connection Details
        </h4>
        <div style="font-size: 13px; color: #999999; line-height: 1.8;">
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

      // Hide/show content when minimizing
      const tabNav = this.container.querySelector('#mcp-sidebar-tabnav') as HTMLElement;
      const content = this.container.querySelector('#mcp-sidebar-content') as HTMLElement;
      const headerTitle = this.container.querySelector('#mcp-sidebar-title') as HTMLElement;
      const minimizeBtn = this.container.querySelector('button') as HTMLButtonElement;

      if (tabNav) {
        tabNav.style.display = this.isMinimized ? 'none' : 'flex';
      }
      if (content) {
        content.style.display = this.isMinimized ? 'none' : 'block';
      }
      if (headerTitle) {
        headerTitle.style.display = this.isMinimized ? 'none' : 'block';
      }
      if (minimizeBtn) {
        minimizeBtn.innerHTML = this.isMinimized ? '→' : '←';
      }
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
