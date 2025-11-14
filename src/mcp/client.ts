import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { EventEmitter } from './event-emitter';
import { WebSocketTransport } from './transports/websocket-transport';
import {
  ConnectionRequest,
  MCPTool,
  ToolCallRequest,
  ToolCallResult,
  TransportType,
} from '../types';

/**
 * Simplified MCP Client with support for all three transports:
 * - SSE (Server-Sent Events)
 * - WebSocket
 * - Streamable HTTP
 */
export class MCPClient extends EventEmitter {
  private client: Client | null = null;
  private transport: Transport | null = null;
  private currentUri: string | null = null;
  private currentType: TransportType | null = null;
  private tools: MCPTool[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000;
  private isInitialized = false;

  constructor() {
    super();
  }

  /**
   * Connect to MCP proxy with specified transport
   */
  async connect(request: ConnectionRequest): Promise<void> {
    if (this.client) {
      await this.disconnect();
    }

    this.currentUri = request.uri;
    this.currentType = request.type;

    try {
      console.log(`[MCP Client] Connecting via ${request.type} to ${request.uri}`);

      // Create transport based on type
      this.transport = await this.createTransport(request.type, request.uri);

      // Create MCP client
      this.client = new Client(
        {
          name: 'chatgpt-mcp-extension',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect client to transport
      await this.client.connect(this.transport);

      console.log('[MCP Client] ✅ Connected successfully to', request.uri);
      console.log('[MCP Client] Transport:', request.type);

      // Fetch available tools
      await this.fetchTools();

      console.log(`[MCP Client] ✅ Fetched ${this.tools.length} tools`);
      console.log('[MCP Client] Available tools:', this.tools.map(t => t.name).join(', '));

      this.reconnectAttempts = 0;
      this.isInitialized = true;
      this.emit('connected', { type: request.type, uri: request.uri });
    } catch (error) {
      console.error('[MCP Client] ❌ Connection failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create transport based on type
   */
  private async createTransport(type: TransportType, uri: string): Promise<Transport> {
    const url = new URL(uri);

    switch (type) {
      case 'sse':
        console.log('[MCP Client] Creating SSE transport');
        return new SSEClientTransport(url);

      case 'websocket':
        console.log('[MCP Client] Creating WebSocket transport');
        const wsTransport = new WebSocketTransport(uri, {
          protocols: ['mcp-v1'],
          binaryType: 'arraybuffer',
        });

        // Set up disconnection handler
        wsTransport.on('close', () => {
          this.handleDisconnect();
        });

        wsTransport.on('error', (error: any) => {
          console.error('[MCP Client] Transport error:', error);
        });

        return wsTransport;

      case 'streamable-http':
        console.log('[MCP Client] Creating Streamable HTTP transport');
        return new StreamableHTTPClientTransport(url);

      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }

  /**
   * Handle disconnection and auto-reconnect
   */
  private handleDisconnect(): void {
    this.isInitialized = false;
    this.emit('disconnected');

    // Auto-reconnect for WebSocket
    if (
      this.currentType === 'websocket' &&
      this.reconnectAttempts < this.maxReconnectAttempts &&
      this.currentUri
    ) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(
        `[MCP Client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        if (this.currentUri && this.currentType) {
          this.connect({ uri: this.currentUri, type: this.currentType }).catch((error) =>
            console.error('[MCP Client] Reconnection failed:', error)
          );
        }
      }, delay);
    }
  }

  /**
   * Disconnect from proxy
   */
  async disconnect(): Promise<void> {
    console.log('[MCP Client] Disconnecting...');

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('[MCP Client] Error closing client:', error);
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.error('[MCP Client] Error closing transport:', error);
      }
      this.transport = null;
    }

    this.currentUri = null;
    this.currentType = null;
    this.isInitialized = false;
    this.emit('disconnected');
  }

  /**
   * Fetch available tools from server
   */
  private async fetchTools(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    console.log('[MCP Client] Fetching tools...');

    try {
      const result = await this.client.listTools();
      this.tools = (result.tools || []) as any;
      console.log(`[MCP Client] Found ${this.tools.length} tools:`, this.tools.map((t) => t.name));
      this.emit('tools-updated', this.tools);
    } catch (error) {
      console.error('[MCP Client] Failed to fetch tools:', error);
      // Don't throw - connection might still be valid
      this.tools = [];
      this.emit('tools-updated', []);
    }
  }

  /**
   * Call a tool
   */
  async callTool(request: ToolCallRequest): Promise<ToolCallResult> {
    if (!this.client || !this.isInitialized) {
      throw new Error('Client not initialized');
    }

    console.log('[MCP Client] Calling tool:', request.toolName, request.arguments);

    try {
      const result = await this.client.callTool({
        name: request.toolName,
        arguments: request.arguments,
      });

      console.log('[MCP Client] Tool result:', result);
      return result as any;
    } catch (error) {
      console.error('[MCP Client] Tool call failed:', error);
      throw error;
    }
  }

  /**
   * Get available tools
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    if (!this.client || !this.transport) {
      return false;
    }

    // For WebSocket, check actual connection state
    if (this.currentType === 'websocket' && this.transport instanceof WebSocketTransport) {
      return this.transport.isConnectionOpen();
    }

    // For SSE and HTTP, assume connected if client exists
    return this.isInitialized;
  }

  /**
   * Get connection info
   */
  getConnectionInfo(): { type: TransportType | null; uri: string | null } {
    return {
      type: this.currentType,
      uri: this.currentUri,
    };
  }

  /**
   * Get supported transports for a URI
   */
  static getSupportedTransports(uri: string): TransportType[] {
    try {
      const url = new URL(uri);
      const transports: TransportType[] = [];

      if (url.protocol === 'ws:' || url.protocol === 'wss:') {
        transports.push('websocket');
      }

      if (url.protocol === 'http:' || url.protocol === 'https:') {
        transports.push('sse', 'streamable-http');
      }

      return transports;
    } catch {
      return [];
    }
  }
}
