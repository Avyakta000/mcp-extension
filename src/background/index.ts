import { MCPClient } from '../mcp/client';
import {
  MessageType,
  ExtensionMessage,
  ExtensionResponse,
  ConnectionRequest,
  ToolCallRequest,
  ConnectionStatus
} from '../types';

// Global MCP client instance
let mcpClient: MCPClient | null = null;

// Default connection configuration
const DEFAULT_CONFIG: ConnectionRequest = {
  uri: 'ws://localhost:3006/message',
  type: 'websocket'
};

// Get saved connection settings
async function getSavedConfig(): Promise<ConnectionRequest> {
  try {
    const settings = await chrome.storage.local.get(['proxyUrl', 'transportType']);
    if (settings.proxyUrl && settings.transportType) {
      return {
        uri: settings.proxyUrl,
        type: settings.transportType
      };
    }
  } catch (error) {
    console.error('[Background] Failed to load saved settings:', error);
  }
  return DEFAULT_CONFIG;
}

// Initialize MCP client
function initializeMCPClient(): MCPClient {
  if (!mcpClient) {
    mcpClient = new MCPClient();

    // Listen to client events
    mcpClient.on('connected', ({ type, uri }) => {
      console.log(`[Background] MCP connected: ${type} at ${uri}`);
      broadcastToContentScripts({
        type: MessageType.MCP_STATUS_CHANGED,
        payload: {
          isConnected: true,
          transport: type,
          uri
        }
      });
    });

    mcpClient.on('disconnected', () => {
      console.log('[Background] MCP disconnected');
      broadcastToContentScripts({
        type: MessageType.MCP_STATUS_CHANGED,
        payload: {
          isConnected: false
        }
      });
    });

    mcpClient.on('tools-updated', (tools) => {
      console.log(`[Background] Tools updated: ${tools.length} tools available`);
      broadcastToContentScripts({
        type: MessageType.MCP_TOOLS_UPDATED,
        payload: { tools }
      });
    });

    mcpClient.on('error', (error) => {
      console.error('[Background] MCP error:', error);
    });
  }

  return mcpClient;
}

// Broadcast message to all content scripts
async function broadcastToContentScripts(message: ExtensionMessage): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url?.includes('chatgpt.com')) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors if content script is not loaded
        });
      }
    }
  } catch (error) {
    console.error('[Background] Failed to broadcast message:', error);
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((
  message: ExtensionMessage,
  sender,
  sendResponse: (response: ExtensionResponse) => void
) => {
  const client = initializeMCPClient();

  switch (message.type) {
    case MessageType.MCP_CONNECT:
      handleConnect(client, message.payload, sendResponse);
      return true; // Async response

    case MessageType.MCP_DISCONNECT:
      handleDisconnect(client, sendResponse);
      return true; // Async response

    case MessageType.MCP_GET_STATUS:
      handleGetStatus(client, sendResponse);
      return false; // Sync response

    case MessageType.MCP_LIST_TOOLS:
      handleListTools(client, sendResponse);
      return false; // Sync response

    case MessageType.MCP_CALL_TOOL:
      handleCallTool(client, message.payload, sendResponse);
      return true; // Async response

    default:
      sendResponse({
        success: false,
        error: 'Unknown message type'
      });
      return false;
  }
});

// Handler: Connect to MCP proxy
async function handleConnect(
  client: MCPClient,
  payload: ConnectionRequest | undefined,
  sendResponse: (response: ExtensionResponse) => void
): Promise<void> {
  try {
    const config = payload || DEFAULT_CONFIG;
    console.log('[Background] Connecting to MCP:', config);
    await client.connect(config);
    sendResponse({
      success: true,
      data: {
        isConnected: true,
        transport: config.type,
        uri: config.uri
      }
    });
  } catch (error: any) {
    console.error('[Background] Connection failed:', error);
    sendResponse({
      success: false,
      error: error.message || 'Connection failed'
    });
  }
}

// Handler: Disconnect from MCP proxy
async function handleDisconnect(
  client: MCPClient,
  sendResponse: (response: ExtensionResponse) => void
): Promise<void> {
  try {
    await client.disconnect();
    sendResponse({
      success: true,
      data: { isConnected: false }
    });
  } catch (error: any) {
    sendResponse({
      success: false,
      error: error.message || 'Disconnection failed'
    });
  }
}

// Handler: Get connection status
function handleGetStatus(
  client: MCPClient,
  sendResponse: (response: ExtensionResponse<ConnectionStatus>) => void
): void {
  const info = client.getConnectionInfo();
  sendResponse({
    success: true,
    data: {
      isConnected: client.isConnected(),
      transport: info.type || undefined,
      uri: info.uri || undefined
    }
  });
}

// Handler: List available tools
function handleListTools(
  client: MCPClient,
  sendResponse: (response: ExtensionResponse) => void
): void {
  try {
    const tools = client.getTools();
    sendResponse({
      success: true,
      data: { tools }
    });
  } catch (error: any) {
    sendResponse({
      success: false,
      error: error.message || 'Failed to list tools'
    });
  }
}

// Handler: Call a tool
async function handleCallTool(
  client: MCPClient,
  payload: ToolCallRequest | undefined,
  sendResponse: (response: ExtensionResponse) => void
): Promise<void> {
  if (!payload) {
    sendResponse({
      success: false,
      error: 'Missing tool call payload'
    });
    return;
  }

  try {
    console.log('[Background] Calling tool:', payload.toolName, payload.arguments);
    const startTime = Date.now();
    const result = await client.callTool(payload);
    const duration = Date.now() - startTime;
    console.log(`[Background] Tool call completed in ${duration}ms:`, result);

    sendResponse({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[Background] Tool call failed:', error);
    sendResponse({
      success: false,
      error: error.message || 'Tool call failed'
    });
  }
}

// Auto-connect on extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] Extension started, auto-connecting to MCP...');
  const client = initializeMCPClient();
  const config = await getSavedConfig();
  client.connect(config).catch(error => {
    console.error('[Background] Auto-connect failed:', error);
  });
});

// Auto-connect when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Background] Extension installed, auto-connecting to MCP...');
  const client = initializeMCPClient();
  const config = await getSavedConfig();
  client.connect(config).catch(error => {
    console.error('[Background] Auto-connect failed:', error);
  });
});

console.log('[Background] Service worker loaded');
