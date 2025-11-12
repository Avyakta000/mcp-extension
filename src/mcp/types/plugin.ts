import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export interface PluginMetadata {
  name: string;
  version: string;
  transportType: 'sse' | 'websocket' | 'streamable-http';
  description: string;
  author: string;
}

export interface PluginConfig {
  [key: string]: any;
}

export interface ITransportPlugin {
  readonly metadata: PluginMetadata;

  initialize(config: PluginConfig): Promise<void>;
  connect(uri: string): Promise<Transport>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  isSupported(uri: string): boolean;
  getDefaultConfig(): PluginConfig;
  isHealthy(): Promise<boolean>;
  callTool(client: Client, toolName: string, args: any): Promise<any>;
  getPrimitives(client: Client): Promise<any[]>;
}
