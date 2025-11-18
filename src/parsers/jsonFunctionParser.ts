import type { FunctionInfo } from './core/types';
import { CONFIG } from './core/config';

/**
 * JSON function call line types
 */
interface JSONFunctionLine {
  type: 'function_call_start' | 'description' | 'parameter' | 'function_call_end';
  name?: string;
  call_id?: number | string;
  text?: string;
  key?: string;
  value?: any;
}

/**
 * State for tracking JSON function call parsing
 */
interface JSONFunctionState {
  hasFunctionStart: boolean;
  hasFunctionEnd: boolean;
  functionName: string | null;
  callId: string | null;
  description: string | null;
  parameterCount: number;
  lines: JSONFunctionLine[];
}

/**
 * Parse a single line of JSON function call
 */
const parseJSONLine = (line: string): JSONFunctionLine | null => {
  try {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Strip language tags and copy-code prefixes that might appear before JSON
    const cleaned = stripLanguageTags(trimmed);
    if (!cleaned) return null;

    const parsed = JSON.parse(cleaned);

    // Validate it's a function call line
    if (!parsed.type || typeof parsed.type !== 'string') {
      return null;
    }

    return parsed as JSONFunctionLine;
  } catch (e) {
    return null;
  }
};

/**
 * Strip Language tags and prefixes from a line
 * Handles various formats like: json, javascript, "Copy code", etc.
 */
export const stripLanguageTags = (line: string): string => {
  const trimmed = line.trim();

  // First, strip markdown code fence markers (```)
  let cleaned = trimmed.replace(/^```\s*(javascript|typescript|markdown|csharp|kotlin|python|jsonl|bash|rust|java|scala|swift|shell|json|text|perl|yaml|toml|html|ruby|cpp|php|lua|css|sql|yml|ini|xml|ts|js|py|sh|md|cs|go|rb|c|r)?\s*/i, '');

  // Then strip language tags with optional "copy" or "copy code" suffix
  cleaned = cleaned.replace(/^(javascript|typescript|markdown|csharp|kotlin|python|jsonl|bash|rust|java|scala|swift|shell|json|text|perl|yaml|toml|html|ruby|cpp|php|lua|css|sql|yml|ini|xml|ts|js|py|sh|md|cs|go|rb|c|r)(\s*copy(\s*code)?)?\s*/i, '');

  // Strip standalone "copy" or "copy code" buttons that might remain
  cleaned = cleaned.replace(/^[cC]opy(\s+code)?\s*/i, '');

  return cleaned;
};

/**
 * Reconstruct complete JSON objects from pretty-printed multi-line format
 */
function reconstructJSONObjects(lines: string[]): string[] {
  const reconstructed: string[] = [];
  let currentObject = '';
  let braceDepth = 0;
  let inObject = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Count braces to track object boundaries
    for (const char of trimmed) {
      if (char === '{') {
        braceDepth++;
        inObject = true;
      } else if (char === '}') {
        braceDepth--;
      }
    }

    // Accumulate lines for current object
    currentObject += (currentObject ? ' ' : '') + trimmed;

    // When braces balance back to 0, we have a complete object
    if (inObject && braceDepth === 0) {
      reconstructed.push(currentObject);
      currentObject = '';
      inObject = false;
    }
  }

  // If there's leftover content (incomplete object), add it
  if (currentObject.trim()) {
    reconstructed.push(currentObject);
  }

  return reconstructed;
}

/**
 * Check if content contains JSON-style function calls
 * Returns detailed information about the JSON function call state
 */
export const containsJSONFunctionCalls = (block: HTMLElement): FunctionInfo => {
  let content = block.textContent?.trim() || '';

  const codeChild = block.querySelector('code');
  if (codeChild && codeChild.textContent) {
    content = codeChild.textContent.trim();
  }

  const result: FunctionInfo = {
    hasFunctionCalls: false,
    isComplete: false,
    hasInvoke: false,
    hasParameters: false,
    hasClosingTags: false,
    languageTag: null,
    detectedBlockType: null,
    partialTagDetected: false,
  };

  // Quick check: must contain JSON-like patterns
  const hasTypeField = content.includes('"type"') || content.includes("'type'") || content.includes('type:');
  const hasFunctionCall = content.includes('function_call') ||
                         (content.includes('"type"') && /function_call_\w*/.test(content)) ||
                         (content.includes('"type"') && content.includes('function_ca'));
  const hasParameter = content.includes('"parameter"') || content.includes("'parameter'") || content.includes('parameter');
  const looksLikeJSONStart = content.includes('{"type"') || content.includes('{ "type"');

  if (!(hasTypeField && (hasFunctionCall || hasParameter || looksLikeJSONStart))) {
    return result;
  }

  const state: JSONFunctionState = {
    hasFunctionStart: false,
    hasFunctionEnd: false,
    functionName: null,
    callId: null,
    description: null,
    parameterCount: 0,
    lines: [],
  };

  // Parse line by line
  let lines = content.split('\n');
  let hasPartialJSON = false;

  // Detect if JSON objects are on a single line (multiple objects without newlines)
  const isSingleLineFormat = lines.length === 1 && (content.match(/\{/g) || []).length > 1;

  // Detect pretty-printed JSON (objects span multiple lines with indentation)
  const isPrettyPrinted = lines.length > 1 &&
                         (content.includes('{\n') || content.includes('{ \n') ||
                          lines.some(line => line.trim() === '{'));

  if (isSingleLineFormat) {
    // Split by "} {" pattern to separate individual JSON objects
    const splitContent = content.split(/\}\s*\{/);

    lines = splitContent.map((part, index, array) => {
      if (index === 0) return part + '}';
      if (index === array.length - 1) return '{' + part;
      return '{' + part + '}';
    });
  } else if (isPrettyPrinted) {
    // Reconstruct complete JSON objects from multi-line format
    lines = reconstructJSONObjects(lines);
  }

  for (const line of lines) {
    const parsed = parseJSONLine(line);
    if (!parsed) {
      // Check if line looks like incomplete JSON
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
        hasPartialJSON = true;
      }
      continue;
    }

    state.lines.push(parsed);

    switch (parsed.type) {
      case 'function_call_start':
        state.hasFunctionStart = true;
        state.functionName = parsed.name || null;
        state.callId = parsed.call_id?.toString() || null;
        break;

      case 'description':
        state.description = parsed.text || null;
        break;

      case 'parameter':
        state.parameterCount++;
        break;

      case 'function_call_end':
        state.hasFunctionEnd = true;
        break;
    }
  }

  // Determine if this is a JSON function call
  if (state.hasFunctionStart || (hasPartialJSON && looksLikeJSONStart)) {
    result.hasFunctionCalls = true;
    result.detectedBlockType = 'json';
    result.hasInvoke = state.hasFunctionStart;
    result.hasParameters = state.parameterCount > 0;
    result.hasClosingTags = state.hasFunctionEnd;
    result.isComplete = state.hasFunctionStart && state.hasFunctionEnd;
    result.invokeName = state.functionName || undefined;
    result.callId = state.callId || undefined;
    result.textContent = state.description || undefined;
    result.partialTagDetected = hasPartialJSON;
  }

  return result;
};

/**
 * Extract function name and call_id from JSON function calls
 */
export const extractJSONFunctionInfo = (content: string): {
  functionName: string | null;
  callId: string | null;
  description: string | null;
} => {
  const lines = content.split('\n');
  let functionName: string | null = null;
  let callId: string | null = null;
  let description: string | null = null;

  for (const line of lines) {
    const parsed = parseJSONLine(line);
    if (!parsed) {
      // Try to extract from partial JSON line
      let trimmed = line.trim();
      trimmed = trimmed.replace(/^(javascript|typescript|markdown|csharp|kotlin|python|jsonl|bash|rust|java|scala|swift|shell|json|text|perl|yaml|toml|html|ruby|cpp|php|lua|css|sql|yml|ini|xml|ts|js|py|sh|md|cs|go|rb|c|r)(\s*copy(\s*code)?)?\s*/i, '');

      if (trimmed.startsWith('{') && trimmed.includes('"type"') && trimmed.includes('function_call_start')) {
        const nameMatch = trimmed.match(/"name"\s*:\s*"([^"]+)"/);
        if (nameMatch) {
          functionName = nameMatch[1];
        }
        const callIdMatch = trimmed.match(/"call_id"\s*:\s*(\d+|"[^"]+")/);
        if (callIdMatch) {
          callId = callIdMatch[1].replace(/"/g, '');
        }
      }
      continue;
    }

    if (parsed.type === 'function_call_start') {
      functionName = parsed.name || null;
      callId = parsed.call_id?.toString() || null;
    } else if (parsed.type === 'description') {
      description = parsed.text || null;
    }

    // Early exit once we have all info
    if (functionName && callId && description) {
      break;
    }
  }

  return { functionName, callId, description };
};

/**
 * Extract parameters from JSON function calls
 */
export const extractJSONParameters = (content: string): Record<string, any> => {
  const parameters: Record<string, any> = {};

  if (!content || typeof content !== 'string') {
    return parameters;
  }

  const lines = content.split('\n');

  // First pass: Extract from complete, parseable JSON lines
  for (const line of lines) {
    const parsed = parseJSONLine(line);
    if (!parsed) continue;

    if (parsed.type === 'parameter' && parsed.key) {
      parameters[parsed.key] = parsed.value ?? '';
    }
  }

  // Second pass: Fallback regex extraction for incomplete/streaming parameter lines
  const parameterPattern = /"type"\s*:\s*"parameter"[^}]*"key"\s*:\s*"([^"]+)"[^}]*"value"\s*:\s*"((?:[^"\\]|\\.)*)/g;

  let match;
  while ((match = parameterPattern.exec(content)) !== null) {
    const key = match[1];
    const value = match[2];

    if (!parameters.hasOwnProperty(key)) {
      const unescapedValue = value
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');

      parameters[key] = unescapedValue;
    }
  }

  return parameters;
};

/**
 * Check if JSON function call is streaming (incomplete)
 */
export const isJSONFunctionStreaming = (content: string): boolean => {
  const lines = content.split('\n');
  let hasStart = false;
  let hasEnd = false;

  for (const line of lines) {
    const parsed = parseJSONLine(line);
    if (!parsed) continue;

    if (parsed.type === 'function_call_start') {
      hasStart = true;
    } else if (parsed.type === 'function_call_end') {
      hasEnd = true;
    }
  }

  return hasStart && !hasEnd;
};
