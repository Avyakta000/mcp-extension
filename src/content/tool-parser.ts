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
   */
  private parseXMLFormat(text: string): DetectedToolCall[] {
    const toolCalls: DetectedToolCall[] = [];
    const functionCallsRegex = /<function_calls>([\s\S]*?)<\/function_calls>/g;
    // Updated regex to handle optional call_id and other attributes
    const invokeRegex = /<invoke\s+name="([^"]+)"[^>]*?>([\s\S]*?)<\/invoke>/gs;
    // Updated to handle CDATA sections and multiline content
    const parameterRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/gs;

    const functionCallsMatches = text.matchAll(functionCallsRegex);

    for (const match of functionCallsMatches) {
      const functionCallsContent = match[1];
      const invokeMatches = Array.from(functionCallsContent.matchAll(invokeRegex));

      for (const invokeMatch of invokeMatches) {
        const toolName = invokeMatch[1];
        const parametersContent = invokeMatch[2];
        const args: Record<string, any> = {};

        const paramMatches = Array.from(parametersContent.matchAll(parameterRegex));
        for (const paramMatch of paramMatches) {
          const paramName = paramMatch[1];
          let paramValue = paramMatch[2].trim();

          // Handle CDATA sections
          const cdataMatch = paramValue.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
          if (cdataMatch) {
            paramValue = cdataMatch[1].trim();
          }

          args[paramName] = this.parseValue(paramValue);
        }

        toolCalls.push({
          id: this.generateId(),
          toolName,
          arguments: args,
          rawText: invokeMatch[0],
          format: 'xml'
        });
      }
    }

    return toolCalls;
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
