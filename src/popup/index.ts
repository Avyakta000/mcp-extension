import { MessageType, ConnectionStatus, MCPTool } from '../types';

// DOM Elements
const connectionStatusEl = document.getElementById('connectionStatus')!;
const transportEl = document.getElementById('transport')!;
const toolCountEl = document.getElementById('toolCount')!;
const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
const toolsListEl = document.getElementById('toolsList')!;
const proxyUrlEl = document.getElementById('proxyUrl') as HTMLInputElement;
const transportTypeEl = document.getElementById('transportType') as HTMLSelectElement;

let currentStatus: ConnectionStatus = { isConnected: false };
let currentTools: MCPTool[] = [];

/**
 * Initialize popup
 */
async function initialize() {
  // Load saved settings
  const settings = await chrome.storage.local.get(['proxyUrl', 'transportType']);
  if (settings.proxyUrl) {
    proxyUrlEl.value = settings.proxyUrl;
  }
  if (settings.transportType) {
    transportTypeEl.value = settings.transportType;
  }

  // Auto-select transport based on URL
  proxyUrlEl.addEventListener('input', () => {
    const url = proxyUrlEl.value.trim();
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      transportTypeEl.value = 'websocket';
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      if (transportTypeEl.value === 'websocket') {
        transportTypeEl.value = 'sse';
      }
    }
  });

  // Get current status
  await updateStatus();

  // Set up event listeners
  connectBtn.addEventListener('click', handleConnect);
  disconnectBtn.addEventListener('click', handleDisconnect);
  refreshBtn.addEventListener('click', handleRefresh);
}

/**
 * Update status from background
 */
async function updateStatus() {
  try {
    // Get connection status
    const statusResponse = await chrome.runtime.sendMessage({
      type: MessageType.MCP_GET_STATUS
    });

    if (statusResponse.success) {
      currentStatus = statusResponse.data;
      updateUI();
    }

    // Get tools
    const toolsResponse = await chrome.runtime.sendMessage({
      type: MessageType.MCP_LIST_TOOLS
    });

    if (toolsResponse.success && toolsResponse.data?.tools) {
      currentTools = toolsResponse.data.tools;
      updateToolsList();
    }
  } catch (error) {
    console.error('Failed to update status:', error);
  }
}

/**
 * Update UI based on current status
 */
function updateUI() {
  // Update connection status badge
  if (currentStatus.isConnected) {
    connectionStatusEl.className = 'status-badge connected';
    connectionStatusEl.textContent = '● Connected';
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
  } else {
    connectionStatusEl.className = 'status-badge disconnected';
    connectionStatusEl.textContent = '● Disconnected';
    connectBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
  }

  // Update transport
  transportEl.textContent = currentStatus.transport || '-';

  // Update tool count
  toolCountEl.textContent = currentTools.length.toString();
}

/**
 * Update tools list
 */
function updateToolsList() {
  if (currentTools.length === 0) {
    toolsListEl.style.display = 'none';
    return;
  }

  toolsListEl.style.display = 'block';
  toolsListEl.innerHTML = '';

  currentTools.forEach(tool => {
    const toolItem = document.createElement('div');
    toolItem.className = 'tool-item';

    const toolName = document.createElement('div');
    toolName.className = 'tool-name';
    toolName.textContent = tool.name;

    const toolDescription = document.createElement('div');
    toolDescription.className = 'tool-description';
    toolDescription.textContent = tool.description || 'No description';

    toolItem.appendChild(toolName);
    toolItem.appendChild(toolDescription);
    toolsListEl.appendChild(toolItem);
  });
}

/**
 * Handle connect button
 */
async function handleConnect() {
  try {
    connectBtn.textContent = 'Connecting...';
    connectBtn.disabled = true;

    const uri = proxyUrlEl.value.trim();
    const type = transportTypeEl.value as 'sse' | 'websocket' | 'streamable-http';

    if (!uri) {
      alert('Please enter a proxy URL');
      return;
    }

    // Save settings
    await chrome.storage.local.set({ proxyUrl: uri, transportType: type });

    const response = await chrome.runtime.sendMessage({
      type: MessageType.MCP_CONNECT,
      payload: {
        uri,
        type
      }
    });

    if (response.success) {
      await updateStatus();
    } else {
      alert(`Connection failed: ${response.error}`);
    }
  } catch (error: any) {
    alert(`Connection error: ${error.message}`);
  } finally {
    connectBtn.textContent = 'Connect to Proxy';
    connectBtn.disabled = false;
  }
}

/**
 * Handle disconnect button
 */
async function handleDisconnect() {
  try {
    disconnectBtn.textContent = 'Disconnecting...';
    disconnectBtn.disabled = true;

    const response = await chrome.runtime.sendMessage({
      type: MessageType.MCP_DISCONNECT
    });

    if (response.success) {
      await updateStatus();
    } else {
      alert(`Disconnection failed: ${response.error}`);
    }
  } catch (error: any) {
    alert(`Disconnection error: ${error.message}`);
  } finally {
    disconnectBtn.textContent = 'Disconnect';
    disconnectBtn.disabled = false;
  }
}

/**
 * Handle refresh button
 */
async function handleRefresh() {
  try {
    refreshBtn.textContent = 'Refreshing...';
    refreshBtn.disabled = true;
    await updateStatus();
  } finally {
    refreshBtn.textContent = 'Refresh Tools';
    refreshBtn.disabled = false;
  }
}

// Initialize on load
initialize();
