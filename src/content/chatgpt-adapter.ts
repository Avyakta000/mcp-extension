import { ChatGPTConfig } from '../types';

export class ChatGPTAdapter {
  private config: ChatGPTConfig = {
    selectors: {
      chatInput: [
        '#prompt-textarea',
        '.ProseMirror[contenteditable="true"]',
        'textarea[placeholder*="Message"]',
        'div[contenteditable="true"][data-id]'
      ],
      sendButton: [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        'button svg[data-icon="arrow-up"]'
      ],
      messageContainer: [
        'div[data-message-author-role]',
        'div.group.w-full',
        'article'
      ],
      buttonInsertionPoint: [
        // Target the button group on the right (where microphone, etc. are)
        'form div.flex.gap-2',
        'form div[class*="gap"]',
        'form button[aria-label*="Voice"]',
        'form button[aria-label*="Microphone"]',
        // Try the parent of existing buttons
        'form div:has(> button[aria-label*="Voice"])',
        'form div:has(> button[aria-label*="mic"])',
        // Generic right side container
        'form > div > div:last-child',
        'form div.flex:last-child',
        // Try finding the form's button container
        'form button[aria-label*="Attach"]',
        'form .flex.items-center button',
        // Old selectors
        '[grid-area="leading"]',
        'div.relative button[aria-label="Attach files"]',
        // Fallback to form itself
        'form'
      ]
    },
    timeouts: {
      domReady: 3000,
      typing: 500,
      submission: 1000
    }
  };

  /**
   * Find element using multiple selector fallbacks
   */
  private findElement(selectors: string[]): HTMLElement | null {
    for (const selector of selectors) {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  /**
   * Find all elements using multiple selector fallbacks
   */
  private findElements(selectors: string[]): HTMLElement[] {
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
      if (elements.length > 0) {
        return elements;
      }
    }
    return [];
  }

  /**
   * Get ChatGPT input element (ProseMirror or textarea)
   */
  getChatInput(): HTMLElement | null {
    return this.findElement(this.config.selectors.chatInput);
  }

  /**
   * Get send button
   */
  getSendButton(): HTMLButtonElement | null {
    return this.findElement(this.config.selectors.sendButton) as HTMLButtonElement;
  }

  /**
   * Get all message elements
   */
  getMessageElements(): HTMLElement[] {
    return this.findElements(this.config.selectors.messageContainer);
  }

  /**
   * Insert text into ChatGPT input (handles ProseMirror)
   */
  insertText(text: string): boolean {
    const input = this.getChatInput();
    if (!input) {
      console.error('[ChatGPT] Input element not found');
      return false;
    }

    try {
      // Check if it's a ProseMirror editor
      if (input.classList.contains('ProseMirror') || input.getAttribute('contenteditable') === 'true') {
        this.insertIntoProseMirror(input, text);
      } else if (input instanceof HTMLTextAreaElement) {
        this.insertIntoTextarea(input, text);
      } else {
        console.error('[ChatGPT] Unknown input type');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ChatGPT] Failed to insert text:', error);
      return false;
    }
  }

  /**
   * Insert text into ProseMirror editor
   */
  private insertIntoProseMirror(element: HTMLElement, text: string): void {
    // Clear existing content
    element.innerHTML = '';

    // Create paragraph node
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    element.appendChild(paragraph);

    // Set cursor to end
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(paragraph);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Dispatch events
    this.dispatchInputEvents(element);

    // Focus the element
    element.focus();
  }

  /**
   * Insert text into textarea
   */
  private insertIntoTextarea(element: HTMLTextAreaElement, text: string): void {
    element.value = text;
    this.dispatchInputEvents(element);
    element.focus();
  }

  /**
   * Dispatch input events to trigger React handlers
   */
  private dispatchInputEvents(element: HTMLElement): void {
    const events = [
      new Event('input', { bubbles: true, cancelable: true }),
      new Event('change', { bubbles: true, cancelable: true }),
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }),
      new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter' })
    ];

    events.forEach(event => element.dispatchEvent(event));
  }

  /**
   * Click send button
   */
  clickSendButton(): boolean {
    const button = this.getSendButton();
    if (!button) {
      console.error('[ChatGPT] Send button not found');
      return false;
    }

    if (button.disabled) {
      console.warn('[ChatGPT] Send button is disabled');
      return false;
    }

    try {
      button.click();
      return true;
    } catch (error) {
      console.error('[ChatGPT] Failed to click send button:', error);
      return false;
    }
  }

  /**
   * Submit message (insert text + click send)
   */
  async submitMessage(text: string): Promise<boolean> {
    if (!this.insertText(text)) {
      return false;
    }

    // Wait for typing simulation
    await this.sleep(this.config.timeouts.typing);

    return this.clickSendButton();
  }

  /**
   * Append text to existing input
   */
  appendText(text: string): boolean {
    const input = this.getChatInput();
    if (!input) {
      return false;
    }

    try {
      if (input.classList.contains('ProseMirror') || input.getAttribute('contenteditable') === 'true') {
        // For ProseMirror, append to last paragraph
        const lastP = input.querySelector('p:last-child');
        if (lastP) {
          lastP.textContent += '\n\n' + text;
        } else {
          this.insertIntoProseMirror(input, text);
        }
      } else if (input instanceof HTMLTextAreaElement) {
        input.value += '\n\n' + text;
      }

      this.dispatchInputEvents(input);
      return true;
    } catch (error) {
      console.error('[ChatGPT] Failed to append text:', error);
      return false;
    }
  }

  /**
   * Get current input text
   */
  getInputText(): string {
    const input = this.getChatInput();
    if (!input) {
      return '';
    }

    if (input instanceof HTMLTextAreaElement) {
      return input.value;
    } else {
      return input.textContent || '';
    }
  }

  /**
   * Clear input
   */
  clearInput(): boolean {
    const input = this.getChatInput();
    if (!input) {
      return false;
    }

    try {
      if (input.classList.contains('ProseMirror') || input.getAttribute('contenteditable') === 'true') {
        input.innerHTML = '<p></p>';
      } else if (input instanceof HTMLTextAreaElement) {
        input.value = '';
      }

      this.dispatchInputEvents(input);
      return true;
    } catch (error) {
      console.error('[ChatGPT] Failed to clear input:', error);
      return false;
    }
  }

  /**
   * Check if ChatGPT is ready
   */
  isChatGPTReady(): boolean {
    return this.getChatInput() !== null && this.getSendButton() !== null;
  }

  /**
   * Wait for ChatGPT to be ready
   */
  async waitForReady(timeout: number = this.config.timeouts.domReady): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.isChatGPTReady()) {
        return true;
      }
      await this.sleep(100);
    }

    return false;
  }

  /**
   * Get button insertion point for MCP button
   */
  getButtonInsertionPoint(): HTMLElement | null {
    console.log('[ChatGPT Adapter] Looking for button insertion point...');
    const element = this.findElement(this.config.selectors.buttonInsertionPoint);
    if (element) {
      console.log('[ChatGPT Adapter] Found insertion point:', element);
    } else {
      console.warn('[ChatGPT Adapter] No insertion point found. Tried selectors:',
        this.config.selectors.buttonInsertionPoint);
      // Log what's available
      console.log('[ChatGPT Adapter] Available form elements:',
        document.querySelectorAll('form').length);
    }
    return element;
  }

  /**
   * Create and inject MCP button
   */
  createMCPButton(onClick: () => void): HTMLButtonElement | null {
    console.log('[ChatGPT Adapter] Creating MCP button...');

    // Check if button already exists
    const existingButton = document.getElementById('mcp-toggle-button');
    if (existingButton) {
      console.log('[ChatGPT Adapter] MCP button already exists');
      return existingButton as HTMLButtonElement;
    }

    const insertionPoint = this.getButtonInsertionPoint();
    if (!insertionPoint) {
      console.error('[ChatGPT Adapter] Button insertion point not found, trying fallback...');
      return this.createMCPButtonFallback(onClick);
    }

    // Create button matching ChatGPT's style
    const button = document.createElement('button');
    button.id = 'mcp-toggle-button';
    button.type = 'button';
    // Match ChatGPT's button styling
    button.className = 'flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:opacity-70';
    button.setAttribute('aria-label', 'Toggle MCP Tools');
    button.title = 'MCP Tools';

    // Style to match other buttons
    button.style.cssText = `
      background: rgb(139, 92, 246);
      color: white;
    `;

    // Add icon
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
              fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });

    // Insert button at the beginning (leftmost position in the group)
    insertionPoint.insertBefore(button, insertionPoint.firstChild);
    console.log('[ChatGPT Adapter] MCP button created and inserted');

    return button;
  }

  /**
   * Fallback: Create floating MCP button if insertion point not found
   */
  private createMCPButtonFallback(onClick: () => void): HTMLButtonElement | null {
    console.log('[ChatGPT Adapter] Using fallback button placement...');

    const button = document.createElement('button');
    button.id = 'mcp-toggle-button';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      z-index: 9999;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
    `;
    button.setAttribute('aria-label', 'Toggle MCP Tools');
    button.title = 'MCP Tools';
    button.innerHTML = '🔧';

    button.onmouseenter = () => {
      button.style.transform = 'scale(1.1)';
    };
    button.onmouseleave = () => {
      button.style.transform = 'scale(1)';
    };

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });

    document.body.appendChild(button);
    console.log('[ChatGPT Adapter] Fallback button created (floating)');

    return button;
  }

  /**
   * Attach a file to ChatGPT input
   */
  async attachFile(file: File): Promise<boolean> {
    try {
      const input = this.getChatInput();
      if (!input) {
        console.error('[ChatGPT] Could not find input element for file attachment');
        return false;
      }

      // Create a DataTransfer object
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Create custom events
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer,
      });

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer,
      });

      // Prevent default on dragover to enable drop
      input.addEventListener('dragover', e => e.preventDefault(), { once: true });
      input.dispatchEvent(dragOverEvent);

      // Simulate the drop event
      input.dispatchEvent(dropEvent);

      console.log(`[ChatGPT] Attached file ${file.name} to input`);
      return true;
    } catch (error) {
      console.error('[ChatGPT] Failed to attach file:', error);
      return false;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Detect if current page is ChatGPT
   */
  static isChatGPT(): boolean {
    return window.location.hostname.includes('chatgpt.com') ||
           window.location.hostname.includes('chat.openai.com');
  }
}
