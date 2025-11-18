import { AutomationState, ToolExecutionCompleteDetail } from '../types';
import { ChatGPTAdapter } from '../content/chatgpt-adapter';

/**
 * AutomationService - Handles auto execute, auto insert, and auto submit functionality
 * Similar to MCP-SuperAssistant's automation service
 */
export class AutomationService {
  private static instance: AutomationService;
  private adapter: ChatGPTAdapter;
  private automationState: AutomationState;
  private isInitialized = false;
  private readonly STORAGE_KEY = 'mcp_automation_state';

  // Default automation state
  private readonly DEFAULT_STATE: AutomationState = {
    autoExecute: false,
    autoInsert: false,
    autoSubmit: false,
    autoExecuteDelay: 0,
    autoInsertDelay: 2,
    autoSubmitDelay: 2,
  };

  private constructor(adapter: ChatGPTAdapter) {
    this.adapter = adapter;
    this.automationState = this.loadState();
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(adapter?: ChatGPTAdapter): AutomationService {
    if (!AutomationService.instance && adapter) {
      AutomationService.instance = new AutomationService(adapter);
    }
    return AutomationService.instance;
  }

  /**
   * Initialize the automation service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Set up event listener for tool execution completion
    this.setupToolExecutionListener();

    this.isInitialized = true;
    console.log('[AutomationService] Initialized with state:', this.automationState);
  }

  /**
   * Set up listener for tool execution complete events
   */
  private setupToolExecutionListener(): void {
    document.addEventListener('mcp:tool-execution-complete', (event: Event) => {
      const customEvent = event as CustomEvent<ToolExecutionCompleteDetail>;
      this.handleToolExecutionComplete(customEvent.detail);
    });
  }

  /**
   * Handle tool execution completion event
   */
  private async handleToolExecutionComplete(detail: ToolExecutionCompleteDetail): Promise<void> {
    console.log('[AutomationService] Tool execution complete:', detail);

    if (detail.skipAutoInsertCheck) {
      return;
    }

    try {
      // Execute automations in sequence based on enabled features and delays
      if (this.automationState.autoExecute) {
        await this.handleAutoExecute(detail);
      }

      if (this.automationState.autoInsert && detail.result) {
        await this.handleAutoInsert(detail);
      }

      if (this.automationState.autoSubmit && this.automationState.autoInsert) {
        await this.handleAutoSubmit(detail);
      }
    } catch (error) {
      console.error('[AutomationService] Error handling tool execution:', error);
    }
  }

  /**
   * Handle auto execute
   */
  private async handleAutoExecute(detail: ToolExecutionCompleteDetail): Promise<void> {
    const delay = this.automationState.autoExecuteDelay * 1000;
    if (delay > 0) {
      await this.sleep(delay);
    }
    console.log('[AutomationService] Auto execute triggered for:', detail.toolName);
  }

  /**
   * Handle auto insert - inserts text result into chat input
   */
  private async handleAutoInsert(detail: ToolExecutionCompleteDetail): Promise<boolean> {
    const delay = this.automationState.autoInsertDelay * 1000;
    if (delay > 0) {
      await this.sleep(delay);
    }

    try {
      if (detail.isFileAttachment && detail.file) {
        const success = await this.adapter.attachFile(detail.file);
        console.log('[AutomationService] Auto insert file result:', success);
        return success;
      } else if (detail.result) {
        // Wrap result in function_result tags
        const wrappedResult = `<function_result call_id="${detail.callId || 'unknown'}">\n${detail.result}\n</function_result>`;
        const success = this.adapter.insertText(wrappedResult);
        console.log('[AutomationService] Auto insert text result:', success);
        return success;
      }
    } catch (error) {
      console.error('[AutomationService] Error during auto insert:', error);
    }

    return false;
  }

  /**
   * Handle auto submit - submits the chat message
   */
  private async handleAutoSubmit(detail: ToolExecutionCompleteDetail): Promise<boolean> {
    const delay = this.automationState.autoSubmitDelay * 1000;
    // Add an additional buffer to ensure insertion is complete
    const totalDelay = delay + 800;

    if (totalDelay > 0) {
      await this.sleep(totalDelay);
    }

    try {
      const success = this.adapter.clickSendButton();
      console.log('[AutomationService] Auto submit result:', success);
      return success;
    } catch (error) {
      console.error('[AutomationService] Error during auto submit:', error);
      return false;
    }
  }

  /**
   * Get current automation state
   */
  public getState(): AutomationState {
    return { ...this.automationState };
  }

  /**
   * Update automation state
   */
  public setState(updates: Partial<AutomationState>): void {
    this.automationState = {
      ...this.automationState,
      ...updates,
    };
    this.saveState();
    console.log('[AutomationService] State updated:', this.automationState);
  }

  /**
   * Toggle auto execute
   */
  public toggleAutoExecute(): void {
    this.setState({ autoExecute: !this.automationState.autoExecute });
  }

  /**
   * Toggle auto insert
   */
  public toggleAutoInsert(): void {
    this.setState({ autoInsert: !this.automationState.autoInsert });
  }

  /**
   * Toggle auto submit
   */
  public toggleAutoSubmit(): void {
    this.setState({ autoSubmit: !this.automationState.autoSubmit });
  }

  /**
   * Set auto execute delay
   */
  public setAutoExecuteDelay(seconds: number): void {
    this.setState({ autoExecuteDelay: Math.max(0, seconds) });
  }

  /**
   * Set auto insert delay
   */
  public setAutoInsertDelay(seconds: number): void {
    this.setState({ autoInsertDelay: Math.max(0, seconds) });
  }

  /**
   * Set auto submit delay
   */
  public setAutoSubmitDelay(seconds: number): void {
    this.setState({ autoSubmitDelay: Math.max(0, seconds) });
  }

  /**
   * Load state from Chrome storage
   */
  private loadState(): AutomationState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...this.DEFAULT_STATE, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[AutomationService] Error loading state:', error);
    }
    return { ...this.DEFAULT_STATE };
  }

  /**
   * Save state to Chrome storage
   */
  private saveState(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.automationState));
    } catch (error) {
      console.error('[AutomationService] Error saving state:', error);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset to default state
   */
  public resetToDefault(): void {
    this.automationState = { ...this.DEFAULT_STATE };
    this.saveState();
    console.log('[AutomationService] Reset to default state');
  }
}
