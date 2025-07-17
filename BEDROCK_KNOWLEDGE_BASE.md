# AWS Bedrock Integration Knowledge Base

## Overview

This document provides comprehensive information about integrating Anthropic's Claude models through AWS Bedrock, including the differences from the standard Anthropic API, tool calling implementation, and JSON response handling.

## Key Differences: Anthropic API vs AWS Bedrock

### 1. SDK Differences

**Standard Anthropic SDK (`@anthropic-ai/sdk`)**
- Direct connection to api.anthropic.com
- Uses API keys for authentication
- Full feature support including beta features

**Bedrock SDK (`@anthropic-ai/bedrock-sdk`)**
- Connects through AWS Bedrock service
- Uses AWS credentials (IAM roles, access keys)
- May have feature limitations or different implementations

### 2. Authentication

**Standard API:**
```typescript
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
```

**Bedrock:**
```typescript
const client = new AnthropicBedrock({
  awsRegion: process.env.AWS_REGION,
  // AWS credentials loaded automatically from environment or credential chain
});
```

## Tool Calling Implementation

### Current Issues

1. **Tool Recognition Problem**: The model is unaware of tools because the Bedrock API may expect different parameter structure.

2. **Current Implementation** (in `bedrockContentGenerator.ts`):
```typescript
const bedrockRequest: Record<string, unknown> = {
  model: this.model,
  max_tokens: maxTokens,
  messages,
};

if (tools.length > 0) {
  bedrockRequest.tools = tools;  // This may not be the correct format for Bedrock
}
```

### Bedrock Tool Calling Requirements

Based on AWS documentation, tool calling in Bedrock requires:

1. **Tool Definition Structure**:
```typescript
interface BedrockTool {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;  // JSON Schema format
}
```

2. **Request Format**: Tools must be passed in the request body with proper structure.

3. **Response Handling**: 
   - When tool is needed, response includes `stop_reason: "tool_use"`
   - Tool details in the `content` field with specific `tool_use` blocks

### Recommended Fix for Tool Calling

The issue may be that the Bedrock SDK expects tools to be passed differently. According to the Bedrock documentation, the Converse API is preferred for tool integration. However, when using the Messages API (which the Anthropic Bedrock SDK uses), ensure:

1. Tools are properly formatted according to Bedrock's expectations
2. The model ID includes proper versioning (e.g., `anthropic.claude-3-5-sonnet-20241022-v2:0`)
3. Tool responses are properly formatted as `tool_result` content blocks

## JSON Response Handling

### Current Issues

1. **Non-strict JSON responses**: Claude through Bedrock isn't strictly following JSON-only instructions.
2. **Response patterns**: Responses may include thinking tags, explanations, or wrapped JSON.

### Current Implementation

The `extractJsonFromResponse` method attempts multiple strategies:
1. Direct JSON parsing
2. Removing thinking tags
3. Pattern matching for JSON objects/arrays
4. Extracting from code blocks

### Recommended Improvements

1. **Stronger System Instructions**:
```typescript
private buildJsonInstructions(schema?: Record<string, unknown>): string {
  let instructions = `CRITICAL: You MUST respond with ONLY valid JSON. 
Do not include ANY text before or after the JSON.
Do not include markdown code blocks.
Do not include explanations or thinking.
Start your response with { or [ and end with } or ].`;
  
  if (schema) {
    instructions += `\n\nThe JSON must conform to this schema: ${JSON.stringify(schema, null, 2)}`;
  }
  
  return instructions;
}
```

2. **Enhanced JSON Extraction**:
```typescript
private extractJsonFromResponse(text: string): string {
  // First, aggressively clean the response
  let cleanText = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
    .replace(/^[^{[]*/, '')  // Remove everything before first { or [
    .replace(/[}\]]\s*[\s\S]*$/, (match) => {
      // Keep the last } or ] and remove everything after
      const lastBrace = match.match(/[}\]]/);
      return lastBrace ? lastBrace[0] : '';
    })
    .trim();
  
  try {
    JSON.parse(cleanText);
    return cleanText;
  } catch {
    // Fallback to existing strategies
    return this.existingExtraction(text);
  }
}
```

## Implementation Fixes

### 1. Tool Calling Fix

The main issue appears to be that tools are being passed but the model doesn't recognize them. This could be due to:

- **Model Version**: Ensure using a model version that supports tools (e.g., Claude 3.5 Sonnet)
- **Tool Format**: The tool format might need adjustment for Bedrock
- **Missing Beta Parameters**: Some features might require beta parameters

**Potential Fix**:
```typescript
// In generateContent method
if (tools.length > 0) {
  // Ensure tools are properly formatted for Bedrock
  bedrockRequest.tools = tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      properties: tool.input_schema?.properties || {},
      required: tool.input_schema?.required || []
    }
  }));
  
  // Some Bedrock models might need this flag
  bedrockRequest.tool_choice = { type: "auto" };
}
```

### 2. JSON Response Fix

**Enhance System Prompt**:
```typescript
if (isJsonMode) {
  const jsonInstructions = `You are a JSON-only assistant. 
Your entire response must be valid JSON.
Do not include any text outside of the JSON structure.
Begin with { or [ and end with } or ].
${responseSchema ? `Follow this schema: ${JSON.stringify(responseSchema)}` : ''}`;
  
  systemPrompt = systemPrompt 
    ? `${systemPrompt}\n\nIMPORTANT: ${jsonInstructions}` 
    : jsonInstructions;
}
```

### 3. Debugging Recommendations

1. **Log the actual request** being sent to Bedrock:
```typescript
console.log('Bedrock Request:', JSON.stringify(bedrockRequest, null, 2));
```

2. **Log the raw response** from Bedrock:
```typescript
const response = await (this.client.messages.create as Function)(bedrockRequest);
console.log('Bedrock Response:', JSON.stringify(response, null, 2));
```

3. **Verify model capabilities**:
   - Ensure the model version supports tool use
   - Check if additional parameters are needed for Bedrock

## AWS Bedrock Specific Considerations

1. **Model IDs**: Use full model IDs like `anthropic.claude-3-5-sonnet-20241022-v2:0`
2. **Region Support**: Not all AWS regions support all Claude models
3. **Quotas**: AWS Bedrock has different quota limits than direct API
4. **Pricing**: Token costs may differ between direct API and Bedrock
5. **Features**: Some beta features may not be available through Bedrock

## Next Steps

1. **Verify Model Support**: Ensure the model being used supports tool calling
2. **Test Tool Format**: Try different tool formatting approaches
3. **Enable Debug Logging**: Add comprehensive logging to understand exact request/response
4. **Consider Converse API**: If Messages API continues to have issues, consider using AWS SDK directly with Converse API
5. **Fallback Strategy**: Implement fallback for when tools aren't recognized

## References

- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [Anthropic Bedrock SDK](https://github.com/anthropics/anthropic-sdk-typescript/tree/main/packages/bedrock-sdk)
- [AWS Bedrock Tool Use Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html)
- [AWS Bedrock Claude Parameters](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-tool-use.html)