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
  private tools: MCPTool[] = [];
  private adapter: ChatGPTAdapter;

  constructor(
    adapter: ChatGPTAdapter,
    onToggleSidebar?: (enabled: boolean) => void,
    onSettingsChange?: (settings: MCPSettings) => void
  ) {
    this.adapter = adapter;
    this.onToggleSidebar = onToggleSidebar;
    this.onSettingsChange = onSettingsChange;
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
      return;
    }

    this.createModal();
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
      padding: 24px;
      min-width: 400px;
      max-width: 500px;
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
      'Open MCP tools sidebar',
      this.settings.enabled,
      (value) => {
        this.settings.enabled = value;
        this.saveSettings();

        // Toggle sidebar
        if (this.onToggleSidebar) {
          this.onToggleSidebar(value);
        }
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

    // Instructions Section
    const instructionsSection = this.createInstructionsSection();
    settingsContainer.appendChild(instructionsSection);

    content.appendChild(settingsContainer);
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
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
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
    textarea.value = this.settings.instructions;
    textarea.placeholder = 'e.g., Always explain your reasoning before using tools...';
    textarea.rows = 4;
    textarea.style.cssText = `
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      resize: vertical;
      box-sizing: border-box;
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
    section.appendChild(buttonsRow);

    return section;
  }

  /**
   * Copy instructions to clipboard
   */
  private async copyInstructions(button: HTMLButtonElement): Promise<void> {
    const originalText = button.textContent;
    try {
      const instructions = generateMCPInstructions(this.tools, this.settings.instructions);
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
      const instructions = generateMCPInstructions(this.tools, this.settings.instructions);
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
}
