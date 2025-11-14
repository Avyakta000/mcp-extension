import { DetectedToolCall } from '../types';

export class ToolCallParser {
  private idCounter = 0;

  /**
   * Parse message text for tool calls
   */
  parseMessage(text: string): DetectedToolCall[] {
    const toolCalls: DetectedToolCall[] = [];

    // Try XML format first
    const xmlCalls = this.parseXMLFormat(text);
    toolCalls.push(...xmlCalls);

    // Try JSON format
    if (toolCalls.length === 0) {
      const jsonCalls = this.parseJSONFormat(text);
      toolCalls.push(...jsonCalls);
    }

    return toolCalls;
  }

  /**
   * Parse XML-style function calls (Claude format)
   * Example: <function_calls><invoke name="tool_name"><parameter name="arg1">value</parameter></invoke></function_calls>
   * Also handles streaming (incomplete) content
   */
  private parseXMLFormat(text: string): DetectedToolCall[] {
    const toolCalls: DetectedToolCall[] = [];

    // Try complete format first
    const functionCallsRegex = /<function_calls>([\s\S]*?)<\/function_calls>/g;
    // Also match incomplete function_calls (streaming)
    const incompleteFunctionCallsRegex = /<function_calls>([\s\S]*?)$/;

    // Updated regex to handle optional call_id and other attributes
    // This version handles both complete and incomplete (streaming) invoke tags
    const invokeRegex = /<invoke\s+name="([^"]+)"(?:\s+call_id="([^"]+)")?[^>]*?>([\s\S]*?)(?:<\/invoke>|$)/gs;
    // Updated to handle CDATA sections and multiline content
    // Also handles streaming parameters without closing tag
    const parameterRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)(?:<\/parameter>|$)/gs;

    console.log('[Parser] Parsing text:', text.substring(0, 200));

    let functionCallsContent = '';

    // Try to match complete function_calls first
    const completeMatches = Array.from(text.matchAll(functionCallsRegex));
    console.log('[Parser] Complete function_calls matches:', completeMatches.length);

    if (completeMatches.length > 0) {
      // Process all complete matches
      for (const match of completeMatches) {
        functionCallsContent = match[1];
        this.parseInvokeBlocks(functionCallsContent, toolCalls, invokeRegex, parameterRegex);
      }
    } else {
      // Try incomplete/streaming format
      const incompleteMatch = text.match(incompleteFunctionCallsRegex);
      if (incompleteMatch) {
        console.log('[Parser] Found streaming (incomplete) function_calls');
        functionCallsContent = incompleteMatch[1];
        this.parseInvokeBlocks(functionCallsContent, toolCalls, invokeRegex, parameterRegex);
      }
    }

    console.log('[Parser] Total tool calls parsed:', toolCalls.length);
    return toolCalls;
  }

  /**
   * Parse invoke blocks from function_calls content
   */
  private parseInvokeBlocks(
    content: string,
    toolCalls: DetectedToolCall[],
    invokeRegex: RegExp,
    parameterRegex: RegExp
  ): void {
    // Reset regex state
    invokeRegex.lastIndex = 0;

    const invokeMatches = Array.from(content.matchAll(invokeRegex));
    console.log('[Parser] Found', invokeMatches.length, 'invoke tags');

    for (const invokeMatch of invokeMatches) {
      const toolName = invokeMatch[1];
      const callId = invokeMatch[2] || this.generateId();
      const parametersContent = invokeMatch[3];
      console.log('[Parser] Tool:', toolName, 'Call ID:', callId, 'Parameters:', parametersContent.substring(0, 100));
      const args: Record<string, any> = {};

      // Reset regex state
      parameterRegex.lastIndex = 0;
      const paramMatches = Array.from(parametersContent.matchAll(parameterRegex));
      console.log('[Parser] Found', paramMatches.length, 'parameters');

      for (const paramMatch of paramMatches) {
        const paramName = paramMatch[1];
        let paramValue = paramMatch[2].trim();

        // Handle CDATA sections
        const cdataMatch = paramValue.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
        if (cdataMatch) {
          paramValue = cdataMatch[1].trim();
        }

        args[paramName] = this.parseValue(paramValue);
        console.log('[Parser] Parameter:', paramName, '=', paramValue.substring(0, 50));
      }

      const toolCall = {
        id: callId,
        toolName,
        arguments: args,
        rawText: invokeMatch[0],
        format: 'xml' as const
      };
      console.log('[Parser] ✅ Parsed tool call:', toolCall);
      toolCalls.push(toolCall);
    }
  }

  /**
   * Parse JSON-style function calls
   * Example: {"type": "function_call_start", "name": "tool_name"}
   */
  private parseJSONFormat(text: string): DetectedToolCall[] {
    const toolCalls: DetectedToolCall[] = [];
    const lines = text.split('\n');

    let currentCall: Partial<DetectedToolCall> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;

      try {
        const json = JSON.parse(trimmed);

        if (json.type === 'function_call_start' && json.name) {
          currentCall = {
            id: this.generateId(),
            toolName: json.name,
            arguments: {},
            rawText: trimmed,
            format: 'json'
          };
        } else if (json.type === 'function_call_arg' && currentCall && json.name && json.value !== undefined) {
          currentCall.arguments = currentCall.arguments || {};
          currentCall.arguments[json.name] = json.value;
          currentCall.rawText += '\n' + trimmed;
        } else if (json.type === 'function_call_end' && currentCall) {
          currentCall.rawText += '\n' + trimmed;
          toolCalls.push(currentCall as DetectedToolCall);
          currentCall = null;
        }
      } catch (e) {
        // Not valid JSON, skip
      }
    }

    // If call wasn't closed, still add it
    if (currentCall && currentCall.toolName) {
      toolCalls.push(currentCall as DetectedToolCall);
    }

    return toolCalls;
  }

  /**
   * Parse string value to appropriate type
   */
  private parseValue(value: string): any {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch (e) {
      // Return as string
      return value;
    }
  }

  /**
   * Generate unique ID for tool call
   */
  private generateId(): string {
    return `tool-call-${Date.now()}-${this.idCounter++}`;
  }
}
