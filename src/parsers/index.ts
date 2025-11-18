/**
 * Parser module - Comprehensive function call detection and parsing
 * Based on MCP-SuperAssistant's render_prescript
 *
 * This module provides advanced parsing capabilities for:
 * - XML format function calls (Claude Opus style)
 * - JSON format function calls
 * - Streaming content detection
 * - Language tag extraction
 * - Parameter extraction
 */

export * from './core/types';
export * from './core/config';
export * from './languageParser';
export * from './functionParser';
export * from './jsonFunctionParser';
