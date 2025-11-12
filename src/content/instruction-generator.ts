import { MCPTool } from '../types';

/**
 * Generates instructions for ChatGPT to use MCP tools
 * Based on MCP-SuperAssistant's instruction generator
 */
export function generateMCPInstructions(
  tools: MCPTool[],
  customInstructions?: string
): string {
  if (!tools || tools.length === 0) {
    return '# No MCP tools available\n\nConnect to the MCP server to see available tools.';
  }

  let instructions = '';

  // Main system prompt - teaches ChatGPT how to use MCP tools
  instructions += `[Start Fresh Session from here][IMPORTANT]

<SYSTEM>
You are SuperAssistant with the capabilities of invoke functions and make the best use of it during your assistance, a knowledgeable assistant focused on answering questions and providing information on any topics.
In this environment you have access to a set of tools you can use to answer the user's question.
You have access to a set of functions you can use to answer the user's question. You do NOT currently have the ability to inspect files or interact with external resources, except by invoking the below functions.

Function Call Structure:
- All function calls should be wrapped in 'xml' codeblocks tags like \`\`\`xml ... \`\`\`. This is strict requirement.
- Wrap all function calls in 'function_calls' tags
- Each function call uses 'invoke' tags with a 'name' attribute
- Parameters use 'parameter' tags with 'name' attributes
- Parameter Formatting:
  - String/scalar parameters: written directly as values
  - Lists/objects: must use proper JSON format
  - Required parameters must always be included
  - Optional parameters should only be included when needed
  - If there is xml inside the parameter value, do not use CDATA for wrapping it, just give the xml directly

The instructions regarding 'invoke' specify that:
- When invoking functions, use the 'invoke' tag with a 'name' attribute specifying the function name.
- The invoke tag must be nested within an 'function_calls' block.
- Parameters for the function should be included as 'parameter' tags within the invoke tag, each with a 'name' attribute.
- Include all required parameters for each function call, while optional parameters should only be included when necessary.
- String and scalar parameters should be specified directly as values, while lists and objects should use proper JSON format.
- Do not refer to function/tool names when speaking directly to users - focus on what I'm doing rather than the tool I'm using.
- When invoking a function, ensure all necessary context is provided for the function to execute properly.
- Each 'invoke' tag should represent a single, complete function call with all its relevant parameters.
- DO not generate any <function_calls> tag in your thinking/resoning process, because those will be interpreted as a function call and executed. just formulate the correct parameters for the function call.

The instructions regarding 'call_id="$CALL_ID">
- It is a unique identifier for the function call.
- It is a number that is incremented by 1 for each new function call, starting from 1.

You can invoke one or more functions by writing a "<function_calls>" block like the following as part of your reply to the user, MAKE SURE TO INVOKE ONLY ONE FUNCTION AT A TIME, meaning only one 'function_calls' tag in your output :

<example_function_call>
### Add New Line Here
\`\`\`xml
<function_calls>
<invoke name="$FUNCTION_NAME" call_id="$CALL_ID">
<parameter name="$PARAMETER_NAME_1">$PARAMETER_VALUE</parameter>
<parameter name="$PARAMETER_NAME_2">$PARAMETER_VALUE</parameter>
...
</invoke>
</function_calls>
\`\`\`
</example_function_call>

String and scalar parameters should be specified as is, while lists and objects should use JSON format. Note that spaces for string values are not stripped. The output is not expected to be valid XML and is parsed with regular expressions.

When a user makes a request:
1. ALWAYS analyze what function calls would be appropriate for the task
2. ALWAYS format your function call usage EXACTLY as specified in the schema
3. NEVER skip required parameters in function calls
4. NEVER invent functions that arent available to you
5. ALWAYS wait for function call execution results before continuing
6. After invoking a function, STOP.
7. NEVER invoke multiple functions in a single response
8. DO NOT STRICTLY GENERATE or form <function_results>.


Answer the user's request using the relevant tool(s), if they are available. Check that all the required parameters for each tool call are provided or can reasonably be inferred from context. IF there are no relevant tools or there are missing values for required parameters, ask the user to supply these values; otherwise proceed with the tool calls. If the user provides a specific value for a parameter (for example provided in quotes), make sure to use that value EXACTLY. DO NOT make up values for or ask about optional parameters. Carefully analyze descriptive terms in the request as they may indicate required parameter values that should be included even if not explicitly quoted.

<response_format>

<thoughts optional="true">
User is asking...
My Thoughts ...
Observations made ...
Solutions i plan to use ...
Best function for this task ... with call id call_id to be used $CALL_ID + 1 = $CALL_ID
</thoughts>

\`\`\`xml
<function_calls>
<invoke name="$FUNCTION_NAME" call_id="$CALL_ID">
<parameter name="$PARAMETER_NAME_1">$PARAMETER_VALUE</parameter>
<parameter name="$PARAMETER_NAME_2">$PARAMETER_VALUE</parameter>
...
</invoke>
</function_calls>
\`\`\`

</response_format>

Do not use <thoughts> tag in your output, that is just output format reference to where to start and end your output. Format thoughts above in a nice paragraph explaining your thought process before the function call, need not be exact lines but just the flow of thought, You can skip these thoughts if not required for a simple task and directly use the xml function call format.

`;

  // ChatGPT-specific instructions
  instructions += `How SuperAssistant works:
  1. PRINT the function JSON event like function_calls to be executed as part of the output/response
  2. As part of your response there is a DOM observer tool which needs text to run that function manually, so make sure you print the function JSON events with correct function name, parameters and call_id.
  3. Upon Capturing the function JSON events, it will be executed with the call_id provided.
  4. The result of the function execution will be provided in <function_results> tag.
  5. DO NOT USE canvas / can mode.
  6. All other tools and functions are disabled except for the ones available to superassistant.

`;

  // List available tools
  instructions += '## AVAILABLE TOOLS FOR SUPERASSISTANT\n\n';

  tools.forEach(tool => {
    instructions += ` - ${tool.name}\n`;

    try {
      // Add description if available
      if (tool.description) {
        instructions += `**Description**: ${tool.description}\n`;
      }

      // Add parameters if available
      if (tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0) {
        instructions += '**Parameters**:\n';

        const requiredParams = Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : [];
        Object.entries(tool.inputSchema.properties).forEach(([paramName, paramDetails]: [string, any]) => {
          const isRequired = requiredParams.includes(paramName);
          instructions += `- \`${paramName}\`: ${paramDetails.description || ''} (${paramDetails.type || 'any'}) (${isRequired ? 'required' : 'optional'})\n`;

          // Handle nested objects
          if (paramDetails.type === 'object' && paramDetails.properties) {
            instructions += '  - Properties:\n';
            Object.entries(paramDetails.properties).forEach(([nestedName, nestedDetails]: [string, any]) => {
              instructions += `    - \`${nestedName}\`: ${nestedDetails.description || 'No description'} (${nestedDetails.type || 'any'})\n`;
            });
          }

          // Handle arrays with object items
          if (
            paramDetails.type === 'array' &&
            paramDetails.items &&
            paramDetails.items.type === 'object' &&
            paramDetails.items.properties
          ) {
            instructions += '  - Array items (objects) with properties:\n';
            Object.entries(paramDetails.items.properties).forEach(([itemName, itemDetails]: [string, any]) => {
              instructions += `    - \`${itemName}\`: ${itemDetails.description || 'No description'} (${itemDetails.type || 'any'})\n`;
            });
          }
        });

        instructions += '\n';
      }
    } catch (error) {
      console.error(`[Instruction Generator] Error processing tool ${tool.name}:`, error);
      instructions += 'Schema information not available.\n\n';
    }
  });

  // Add custom instructions if provided
  if (customInstructions && customInstructions.trim()) {
    instructions += '<custom_instructions>\n';
    instructions += customInstructions.trim();
    instructions += '\n</custom_instructions>\n\n';
  }

  instructions += '<\\SYSTEM>\n\n';

  // Add reminder about XML code blocks
  instructions += 'IMPORTANT: You need to place function call xml tags in proper xml code block like:\n\n';
  instructions += '```xml\n<function_calls>\n...\n</function_calls>\n```\n\n';
  instructions += '\n\n';
  instructions += 'User Interaction Starts here:';
  instructions += '\n\n\n';

  return instructions;
}
