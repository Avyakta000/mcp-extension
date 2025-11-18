// MCP Types
export type TransportType = 'sse' | 'websocket' | 'streamable-http';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface ConnectionRequest {
  uri: string;
  type: TransportType;
}

export interface ConnectionStatus {
  isConnected: boolean;
  transport?: TransportType;
  uri?: string;
  error?: string;
  connectedAt?: number;
  lastReconnectedAt?: number;
}

export interface ToolCallRequest {
  toolName: string;
  arguments: Record<string, any>;
}

export interface ToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

// Message Types for Chrome Extension
export enum MessageType {
  // MCP Operations
  MCP_CONNECT = 'MCP_CONNECT',
  MCP_DISCONNECT = 'MCP_DISCONNECT',
  MCP_GET_STATUS = 'MCP_GET_STATUS',
  MCP_LIST_TOOLS = 'MCP_LIST_TOOLS',
  MCP_CALL_TOOL = 'MCP_CALL_TOOL',

  // Status Updates
  MCP_STATUS_CHANGED = 'MCP_STATUS_CHANGED',
  MCP_TOOLS_UPDATED = 'MCP_TOOLS_UPDATED',

  // UI Operations
  INJECT_RESULT = 'INJECT_RESULT',
  SHOW_NOTIFICATION = 'SHOW_NOTIFICATION'
}

export interface ExtensionMessage<T = any> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}

export interface ExtensionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
}

// ChatGPT Specific Types
export interface ChatGPTConfig {
  selectors: {
    chatInput: string[];
    sendButton: string[];
    messageContainer: string[];
    buttonInsertionPoint: string[];
  };
  timeouts: {
    domReady: number;
    typing: number;
    submission: number;
  };
}

export interface DetectedToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  rawText: string;
  format: 'xml' | 'json';
  element?: HTMLElement;
}

// JSON-RPC Types
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}
