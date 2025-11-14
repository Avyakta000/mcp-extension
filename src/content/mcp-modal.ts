/**
 * MCP Settings Modal
 * Shows popup with MCP toggle, auto-execute toggle, and instructions
 */

import { MCPTool } from '../types';
import { generateMCPInstructions } from './instruction-generator';
import { ChatGPTAdapter } from './chatgpt-adapter';

export interface MCPSettings {
  enabled: boolean;
  autoExecute: boolean;
  instructions: string;
}

export class MCPModal {
  private modal: HTMLElement | null = null;
  private settings: MCPSettings = {
    enabled: false,
    autoExecute: false,
    instructions: ''
  };
  private onToggleSidebar?: (enabled: boolean) => void;
  private onSettingsChange?: (settings: MCPSettings) => void;
  private getSelectedTools?: () => string[];
  private tools: MCPTool[] = [];
  private adapter: ChatGPTAdapter;
  private isSidebarVisible: boolean = false;

  constructor(
    adapter: ChatGPTAdapter,
    onToggleSidebar?: (enabled: boolean) => void,
    onSettingsChange?: (settings: MCPSettings) => void,
    getSelectedTools?: () => string[]
  ) {
    this.adapter = adapter;
    this.onToggleSidebar = onToggleSidebar;
    this.onSettingsChange = onSettingsChange;
    this.getSelectedTools = getSelectedTools;
    this.loadSettings();
  }

  /**
   * Update available tools
   */
  updateTools(tools: MCPTool[]): void {
    this.tools = tools;
  }

  /**
   * Load settings from chrome storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(['mcpEnabled', 'mcpAutoExecute', 'mcpInstructions']);
      this.settings = {
        enabled: stored.mcpEnabled ?? false,
        autoExecute: stored.mcpAutoExecute ?? false,
        instructions: stored.mcpInstructions ?? ''
      };
    } catch (error) {
      console.error('[MCP Modal] Failed to load settings:', error);
    }
  }

  /**
   * Save settings to chrome storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await chrome.storage.local.set({
        mcpEnabled: this.settings.enabled,
        mcpAutoExecute: this.settings.autoExecute,
        mcpInstructions: this.settings.instructions
      });

      // Notify listeners
      if (this.onSettingsChange) {
        this.onSettingsChange(this.settings);
      }

      console.log('[MCP Modal] Settings saved:', this.settings);
    } catch (error) {
      console.error('[MCP Modal] Failed to save settings:', error);
    }
  }

  /**
   * Show the modal
   */
  show(): void {
    if (this.modal) {
      this.modal.style.display = 'flex';
      this.updateModalContent();
      return;
    }

    this.createModal();
  }

  /**
   * Update sidebar visibility state
   */
  setSidebarVisible(visible: boolean): void {
    this.isSidebarVisible = visible;
    this.updateModalContent();
  }

  /**
   * Hide the modal
   */
  hide(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }

  /**
   * Create modal UI
   */
  private createModal(): void {
    // Modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'mcp-settings-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    // Modal content
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 20px;
      width: 450px;
      max-width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    `;

    const title = document.createElement('h2');
    title.textContent = 'MCP Settings';
    title.style.cssText = `
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #111827;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b7280;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: background 0.2s;
    `;
    closeBtn.onmouseenter = () => closeBtn.style.background = '#f3f4f6';
    closeBtn.onmouseleave = () => closeBtn.style.background = 'none';
    closeBtn.onclick = () => this.hide();

    header.appendChild(title);
    header.appendChild(closeBtn);
    content.appendChild(header);

    // Settings container
    const settingsContainer = document.createElement('div');
    settingsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // MCP Toggle
    const mcpToggle = this.createToggleRow(
      'Enable MCP',
      'Enable MCP functionality',
      this.settings.enabled,
      (value) => {
        this.settings.enabled = value;
        this.saveSettings();

        // Just save the setting, don't toggle sidebar
        // Sidebar is controlled by the dedicated button below
      }
    );
    settingsContainer.appendChild(mcpToggle);

    // Auto-execute Toggle
    const autoExecuteToggle = this.createToggleRow(
      'Auto-execute',
      'Automatically execute tool calls',
      this.settings.autoExecute,
      (value) => {
        this.settings.autoExecute = value;
        this.saveSettings();
      }
    );
    settingsContainer.appendChild(autoExecuteToggle);

    // Sidebar Toggle Button
    const sidebarButton = document.createElement('button');
    sidebarButton.textContent = this.isSidebarVisible ? '👁️ Hide Sidebar' : '👁️ Show Sidebar';
    sidebarButton.style.cssText = `
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 16px;
      transition: opacity 0.2s;
    `;
    sidebarButton.onmouseenter = () => sidebarButton.style.opacity = '0.9';
    sidebarButton.onmouseleave = () => sidebarButton.style.opacity = '1';
    sidebarButton.onclick = () => {
      this.isSidebarVisible = !this.isSidebarVisible;
      if (this.onToggleSidebar) {
        this.onToggleSidebar(this.isSidebarVisible);
      }
      sidebarButton.textContent = this.isSidebarVisible ? '👁️ Hide Sidebar' : '👁️ Show Sidebar';
    };
    settingsContainer.appendChild(sidebarButton);

    content.appendChild(settingsContainer);

    // Instructions Section (separate from settings container for better layout)
    const instructionsSection = this.createInstructionsSection();
    content.appendChild(instructionsSection);

    // Instructions preview section
    const previewSection = this.createInstructionsPreviewSection();
    content.appendChild(previewSection);
    overlay.appendChild(content);

    // Click outside to close
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this.hide();
      }
    };

    document.body.appendChild(overlay);
    this.modal = overlay;
  }

  /**
   * Create toggle row
   */
  private createToggleRow(
    label: string,
    description: string,
    initialValue: boolean,
    onChange: (value: boolean) => void
  ): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #f9fafb;
      border-radius: 8px;
    `;

    const labelContainer = document.createElement('div');
    labelContainer.style.cssText = `
      flex: 1;
    `;

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.style.cssText = `
      font-weight: 600;
      font-size: 15px;
      color: #111827;
      margin-bottom: 4px;
    `;

    const descEl = document.createElement('div');
    descEl.textContent = description;
    descEl.style.cssText = `
      font-size: 13px;
      color: #6b7280;
    `;

    labelContainer.appendChild(labelEl);
    labelContainer.appendChild(descEl);

    // Toggle switch
    const toggleSwitch = this.createToggleSwitch(initialValue, onChange);

    row.appendChild(labelContainer);
    row.appendChild(toggleSwitch);

    return row;
  }

  /**
   * Create toggle switch
   */
  private createToggleSwitch(
    initialValue: boolean,
    onChange: (value: boolean) => void
  ): HTMLElement {
    const container = document.createElement('label');
    container.style.cssText = `
      position: relative;
      display: inline-block;
      width: 48px;
      height: 28px;
      cursor: pointer;
    `;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initialValue;
    input.style.cssText = `
      opacity: 0;
      width: 0;
      height: 0;
    `;

    const slider = document.createElement('span');
    slider.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: ${initialValue ? '#667eea' : '#cbd5e0'};
      border-radius: 28px;
      transition: 0.3s;
    `;

    const knob = document.createElement('span');
    knob.style.cssText = `
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: ${initialValue ? '24px' : '4px'};
      bottom: 4px;
      background-color: white;
      border-radius: 50%;
      transition: 0.3s;
    `;

    slider.appendChild(knob);
    container.appendChild(input);
    container.appendChild(slider);

    // Handle toggle
    input.onchange = () => {
      const checked = input.checked;
      slider.style.backgroundColor = checked ? '#667eea' : '#cbd5e0';
      knob.style.left = checked ? '24px' : '4px';
      onChange(checked);
    };

    return container;
  }

  /**
   * Create instructions section
   */
  private createInstructionsSection(): HTMLElement {
    const section = document.createElement('div');
    section.id = 'mcp-instructions-section';
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
      margin-top: 16px;
    `;

    const label = document.createElement('label');
    label.textContent = 'Instructions';
    label.style.cssText = `
      font-weight: 600;
      font-size: 15px;
      color: #111827;
    `;

    const description = document.createElement('div');
    description.textContent = 'Customize how the LLM should behave with MCP tools';
    description.style.cssText = `
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 4px;
    `;

    const textarea = document.createElement('textarea');
    textarea.id = 'mcp-instructions-textarea';
    textarea.value = this.settings.instructions;
    textarea.placeholder = 'e.g., Always explain your reasoning before using tools...';
    textarea.rows = 3;
    textarea.style.cssText = `
      width: 100%;
      padding: 10px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 13px;
      font-family: system-ui, -apple-system, sans-serif;
      resize: vertical;
      box-sizing: border-box;
      background: white;
      color: #111827;
    `;

    textarea.onfocus = () => {
      textarea.style.outline = '2px solid #667eea';
      textarea.style.borderColor = '#667eea';
    };

    textarea.onblur = () => {
      textarea.style.outline = 'none';
      textarea.style.borderColor = '#d1d5db';
    };

    // Save instructions on change (debounced)
    let timeout: NodeJS.Timeout;
    textarea.oninput = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.settings.instructions = textarea.value;
        this.saveSettings();
      }, 500);
    };

    section.appendChild(label);
    section.appendChild(description);
    section.appendChild(textarea);

    // Add instruction buttons section
    const buttonsSection = this.createInstructionButtonsSection();
    section.appendChild(buttonsSection);

    return section;
  }

  /**
   * Create instruction buttons section
   */
  private createInstructionButtonsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    `;

    const infoText = document.createElement('div');
    infoText.textContent = 'Insert MCP instructions into ChatGPT to enable tool usage:';
    infoText.style.cssText = `
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 4px;
    `;

    // File upload button container
    const fileUploadRow = document.createElement('div');
    fileUploadRow.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    `;

    // Attach file button
    const attachButton = document.createElement('button');
    attachButton.textContent = '📎 Attach Instructions File';
    attachButton.style.cssText = `
      flex: 1;
      padding: 8px 16px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    `;
    attachButton.onmouseenter = () => attachButton.style.opacity = '0.8';
    attachButton.onmouseleave = () => attachButton.style.opacity = '1';
    attachButton.onclick = () => this.attachInstructionsFile();

    fileUploadRow.appendChild(attachButton);

    const buttonsRow = document.createElement('div');
    buttonsRow.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    // Copy button
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy Instructions';
    copyButton.style.cssText = `
      flex: 1;
      padding: 8px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    `;
    copyButton.onmouseenter = () => copyButton.style.opacity = '0.8';
    copyButton.onmouseleave = () => copyButton.style.opacity = '1';
    copyButton.onclick = () => this.copyInstructions(copyButton);

    // Insert button
    const insertButton = document.createElement('button');
    insertButton.textContent = 'Insert Instructions';
    insertButton.style.cssText = `
      flex: 1;
      padding: 8px 16px;
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    `;
    insertButton.onmouseenter = () => insertButton.style.opacity = '0.8';
    insertButton.onmouseleave = () => insertButton.style.opacity = '1';
    insertButton.onclick = () => this.insertInstructions(insertButton);

    buttonsRow.appendChild(copyButton);
    buttonsRow.appendChild(insertButton);

    section.appendChild(infoText);
    section.appendChild(fileUploadRow);
    section.appendChild(buttonsRow);

    return section;
  }

  /**
   * Attach instructions as a file to ChatGPT input
   */
  private async attachInstructionsFile(): Promise<void> {
    try {
      // Filter tools based on selection
      const selectedToolNames = this.getSelectedTools ? this.getSelectedTools() : this.tools.map(t => t.name);
      const selectedTools = this.tools.filter(tool => selectedToolNames.includes(tool.name));

      // Generate instructions content
      const instructions = generateMCPInstructions(selectedTools, this.settings.instructions);

      // Create a File object
      const file = new File([instructions], 'instructions.md', { type: 'text/markdown' });

      // Use ChatGPTAdapter to attach the file
      const success = await this.adapter.attachFile(file);

      if (success) {
        this.showNotification('✓ Instructions file attached!', 'success');
        console.log('[MCP Modal] Instructions file attached to ChatGPT');

        // Optionally hide modal after attachment
        setTimeout(() => this.hide(), 1500);
      } else {
        throw new Error('Failed to attach file to ChatGPT input');
      }
    } catch (error) {
      console.error('[MCP Modal] Failed to attach file:', error);
      this.showNotification('✗ Failed to attach file', 'error');
    }
  }

  /**
   * Show temporary notification
   */
  private showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 100000;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  /**
   * Copy instructions to clipboard
   */
  private async copyInstructions(button: HTMLButtonElement): Promise<void> {
    const originalText = button.textContent;
    try {
      // Filter tools based on selection
      const selectedToolNames = this.getSelectedTools ? this.getSelectedTools() : this.tools.map(t => t.name);
      const selectedTools = this.tools.filter(tool => selectedToolNames.includes(tool.name));

      const instructions = generateMCPInstructions(selectedTools, this.settings.instructions);
      await navigator.clipboard.writeText(instructions);

      button.textContent = '✓ Copied!';
      button.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';

      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }, 2000);

      console.log('[MCP Modal] Instructions copied to clipboard');
    } catch (error) {
      console.error('[MCP Modal] Failed to copy instructions:', error);

      button.textContent = '✗ Failed';
      button.style.background = 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)';

      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }, 2000);
    }
  }

  /**
   * Insert instructions into ChatGPT input
   */
  private insertInstructions(button: HTMLButtonElement): void {
    const originalText = button.textContent;
    try {
      // Filter tools based on selection
      const selectedToolNames = this.getSelectedTools ? this.getSelectedTools() : this.tools.map(t => t.name);
      const selectedTools = this.tools.filter(tool => selectedToolNames.includes(tool.name));

      const instructions = generateMCPInstructions(selectedTools, this.settings.instructions);
      const success = this.adapter.insertText(instructions);

      if (success) {
        button.textContent = '✓ Inserted!';
        button.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';

        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
        }, 2000);

        console.log('[MCP Modal] Instructions inserted into ChatGPT');

        // Optionally hide modal after insertion
        setTimeout(() => this.hide(), 1500);
      } else {
        throw new Error('Failed to insert text into ChatGPT input');
      }
    } catch (error) {
      console.error('[MCP Modal] Failed to insert instructions:', error);

      button.textContent = '✗ Failed';
      button.style.background = 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)';

      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
      }, 2000);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): MCPSettings {
    return { ...this.settings };
  }

  /**
   * Update settings programmatically
   */
  updateSettings(settings: Partial<MCPSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.saveSettings();
  }

  /**
   * Create instructions preview section
   */
  private createInstructionsPreviewSection(): HTMLElement {
    const section = document.createElement('div');
    section.id = 'mcp-instructions-preview-section';
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px;
      background: #f9fafb;
      border-radius: 8px;
      margin-top: 12px;
    `;

    const label = document.createElement('label');
    label.textContent = 'Instructions Preview';
    label.style.cssText = `
      font-weight: 600;
      font-size: 13px;
      color: #111827;
    `;

    const description = document.createElement('div');
    description.textContent = 'First 500 chars of generated instructions';
    description.style.cssText = `
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 2px;
    `;

    const preview = document.createElement('div');
    preview.id = 'mcp-instructions-preview';
    preview.style.cssText = `
      padding: 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 11px;
      font-family: monospace;
      background: white;
      color: #111827;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 120px;
    `;

    // Generate initial preview
    this.updateInstructionsPreview();

    section.appendChild(label);
    section.appendChild(description);
    section.appendChild(preview);

    return section;
  }

  /**
   * Update instructions preview
   */
  private updateInstructionsPreview(): void {
    const preview = document.getElementById('mcp-instructions-preview');
    if (!preview) return;

    // Filter tools based on selection
    const selectedToolNames = this.getSelectedTools ? this.getSelectedTools() : this.tools.map(t => t.name);
    const selectedTools = this.tools.filter(tool => selectedToolNames.includes(tool.name));

    if (selectedTools.length === 0) {
      preview.textContent = 'No tools selected. Please select tools from the sidebar to generate instructions.';
      preview.style.color = '#9ca3af';
      preview.style.fontStyle = 'italic';
    } else {
      const instructions = generateMCPInstructions(selectedTools, this.settings.instructions);
      preview.textContent = instructions.substring(0, 500) + (instructions.length > 500 ? '\n\n... (truncated for preview)' : '');
      preview.style.color = '#111827';
      preview.style.fontStyle = 'normal';
    }
  }

  /**
   * Refresh preview (called from external sources when tools selection changes)
   */
  refreshPreview(): void {
    this.updateInstructionsPreview();
  }

  /**
   * Update modal content (refresh dynamic elements)
   */
  private updateModalContent(): void {
    // Update textarea if it exists
    const textarea = document.getElementById('mcp-instructions-textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = this.settings.instructions;
    }

    // Update preview
    this.updateInstructionsPreview();
  }
}
