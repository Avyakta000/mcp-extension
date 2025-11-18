import type { FunctionInfo } from './core/types';
import { extractLanguageTag } from './languageParser';
import { containsJSONFunctionCalls, extractJSONFunctionInfo } from './jsonFunctionParser';

/**
 * Analyzes content to determine if it contains function calls
 * and related information about their completeness
 *
 * Supports both XML format (Claude Opus style) and JSON format
 *
 * @param block The HTML element containing potential function call content
 * @returns Information about the detected function calls
 */
export const containsFunctionCalls = (block: HTMLElement): FunctionInfo => {
  const content = block.textContent?.trim() || '';
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

  // First, check for JSON function calls
  const jsonResult = containsJSONFunctionCalls(block);
  if (jsonResult.hasFunctionCalls) {
    // Extract description for JSON format
    const { description } = extractJSONFunctionInfo(content);
    return {
      ...jsonResult,
      description: description || undefined,
    };
  }

  // Check for XML function call content
  if (
    !content.includes('<') &&
    !content.includes('<function_calls>') &&
    !content.includes('<invoke') &&
    !content.includes('</invoke>') &&
    !content.includes('<parameter')
  ) {
    return result;
  }

  // Detect language tag and update content to examine
  const langTagResult = extractLanguageTag(content);
  if (langTagResult.tag) {
    result.languageTag = langTagResult.tag;
  }

  // The content to analyze (with or without language tag)
  const contentToExamine = langTagResult.content || content;

  // Check for Claude Opus style function calls (XML)
  if (contentToExamine.includes('<function_calls>') || contentToExamine.includes('<invoke')) {
    result.hasFunctionCalls = true;
    result.detectedBlockType = 'xml';

    result.hasInvoke = contentToExamine.includes('<invoke');
    result.hasParameters = contentToExamine.includes('<parameter');

    // Extract function name and call_id from invoke tag if present
    if (result.hasInvoke) {
      const invokeMatch = contentToExamine.match(/<invoke name="([^"]+)"(?:\s+call_id="([^"]+)")?>/);
      if (invokeMatch && invokeMatch[1]) {
        result.invokeName = invokeMatch[1];
        if (invokeMatch[2]) {
          result.callId = invokeMatch[2];
        }
      }
    }

    // Check for complete structure
    const hasOpeningTag = contentToExamine.includes('<function_calls>');
    const hasClosingTag = contentToExamine.includes('</function_calls>');

    result.hasClosingTags = hasOpeningTag && hasClosingTag;
    result.isComplete = result.hasClosingTags;
  }

  return result;
};

/**
 * Extract XML parameters from function call content
 */
export const extractXMLParameters = (content: string): Record<string, string> => {
  const parameters: Record<string, string> = {};

  // Match <parameter name="key">value</parameter>
  const paramRegex = /<parameter name="([^"]+)">([^<]*)<\/parameter>/gs;
  let match;

  while ((match = paramRegex.exec(content)) !== null) {
    const paramName = match[1];
    const paramValue = match[2];
    parameters[paramName] = paramValue;
  }

  return parameters;
};

/**
 * Extract function name from XML function call
 */
export const extractFunctionName = (content: string): string | null => {
  const match = content.match(/<invoke name="([^"]+)"/);
  return match ? match[1] : null;
};

/**
 * Extract call ID from function call
 */
export const extractCallId = (content: string): string | null => {
  const match = content.match(/call_id="([^"]+)"/);
  return match ? match[1] : null;
};
