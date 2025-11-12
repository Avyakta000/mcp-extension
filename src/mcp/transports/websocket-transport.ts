import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export interface WebSocketTransportOptions {
  protocols?: string[];
  pingInterval?: number;
  pongTimeout?: number;
  binaryType?: 'blob' | 'arraybuffer';
}

/**
 * WebSocket Transport implementation for MCP SDK
 * This class implements the Transport interface required by MCP Client
 */
export class WebSocketTransport implements Transport {
  // Transport interface callbacks - required by MCP SDK
  onmessage?: (message: any) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  private ws: WebSocket | null = null;
  private url: string;
  private options: WebSocketTransportOptions;
  private messageQueue: any[] = [];
  private isConnected: boolean = false;
  private eventListeners = new Map<string, Set<Function>>();

  constructor(url: string, options: WebSocketTransportOptions = {}) {
    this.url = url;
    this.options = {
      protocols: ['mcp-v1'],
      pingInterval: 30000,
      pongTimeout: 5000,
      binaryType: 'arraybuffer',
      ...options,
    };
  }

  /**
   * Required by Transport interface - starts the connection
   */
  async start(): Promise<void> {
    console.log('[WebSocketTransport] Starting connection...');
    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.isConnected || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('[WebSocketTransport] Already connected or connecting');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`[WebSocketTransport] Connecting to: ${this.url}`);

        this.ws = new WebSocket(this.url, this.options.protocols);
        this.ws.binaryType = this.options.binaryType || 'arraybuffer';

        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('[WebSocketTransport] Connected successfully');
          this.isConnected = true;
          this.processMessageQueue();
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log(`[WebSocketTransport] Disconnected: ${event.code} ${event.reason}`);
          this.isConnected = false;
          this.emit('close', { code: event.code, reason: event.reason });

          // Call Transport interface callback
          if (this.onclose) {
            this.onclose();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('[WebSocketTransport] Error:', error);
          this.isConnected = false;
          this.emit('error', error);

          // Call Transport interface callback
          if (this.onerror) {
            this.onerror(new Error('WebSocket connection failed'));
          }

          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onmessage = (event) => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (event.data instanceof ArrayBuffer) {
              const text = new TextDecoder().decode(event.data);
              data = JSON.parse(text);
            } else {
              console.warn('[WebSocketTransport] Unknown data type:', typeof event.data);
              return;
            }

            this.emit('message', data);

            // Call Transport interface callback - critical for MCP client
            if (this.onmessage) {
              this.onmessage(data);
            }
          } catch (error) {
            console.error('[WebSocketTransport] Failed to parse message:', error);
            const parseError = new Error('Failed to parse WebSocket message');
            this.emit('error', parseError);

            if (this.onerror) {
              this.onerror(parseError);
            }
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Required by Transport interface - closes the connection
   */
  async close(): Promise<void> {
    console.log('[WebSocketTransport] Closing connection');
    this.isConnected = false;

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
  }

  /**
   * Required by Transport interface - sends a message
   */
  async send(data: any): Promise<void> {
    const message = JSON.stringify(data);

    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[WebSocketTransport] Queuing message (not connected)');
      this.messageQueue.push(data);
      return;
    }

    try {
      this.ws.send(message);
    } catch (error) {
      console.error('[WebSocketTransport] Failed to send message:', error);
      this.messageQueue.push(data);
      throw error;
    }
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`[WebSocketTransport] Processing ${this.messageQueue.length} queued messages`);

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    queue.forEach((message) => {
      try {
        this.send(message);
      } catch (error) {
        console.error('[WebSocketTransport] Failed to send queued message:', error);
        this.messageQueue.push(message);
      }
    });
  }

  // Event emitter functionality for internal use
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[WebSocketTransport] Error in ${event} listener:`, error);
        }
      });
    }
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  isConnectionOpen(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}
