/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import type { Message, MessageCreateParamsNonStreaming, MessageCreateParamsStreaming, RawMessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';
import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Content,
  Part,
  Tool,
} from '@google/genai';
import { ContentGenerator, ContentGeneratorConfig } from './contentGenerator.js';
import { Config } from '../config/config.js';

// Define types for Bedrock SDK since they might not be exported
interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string | BedrockContentBlock[];
}

interface BedrockContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface BedrockTool {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
}

interface BedrockResponse {
  content: BedrockContentBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

interface BedrockStreamChunk {
  type: string;
  index?: number;
  delta?: {
    type: string;
    text?: string;
    input?: string;
  };
  content_block?: {
    type: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
}

// Extended request type that includes all possible fields
interface ExtendedGenerateContentParameters {
  contents?: Content[];
  tools?: Tool[];
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
  };
  generation_config?: {
    max_output_tokens?: number;
    temperature?: number;
  };
  systemInstruction?: Content | string;
  system_instruction?: Content | string;
  config?: {
    responseSchema?: Record<string, unknown>;
    responseMimeType?: string;
    systemInstruction?: Content | string;
    maxOutputTokens?: number;
    temperature?: number;
  };
}

export class BedrockContentGenerator implements ContentGenerator {
  private client: AnthropicBedrock;
  private model: string;
  private config: Config;

  constructor(config: ContentGeneratorConfig, gcConfig: Config) {
    this.model = config.model;
    this.config = gcConfig;
    
    // Initialize Bedrock client
    this.client = new AnthropicBedrock({
      awsRegion: process.env.AWS_REGION,
      // AWS credentials are automatically loaded from the environment or AWS credential chain
    });
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const req = {...request} as ExtendedGenerateContentParameters;
    const messages = this.convertToAnthropicMessages(req.contents || []);
    const tools = this.convertToAnthropicTools(req.tools || []);
    
    if (this.config.getDebugMode() && tools.length > 0) {
      console.debug('[BedrockContentGenerator] Converting tools:', JSON.stringify(req.tools, null, 2));
      console.debug('[BedrockContentGenerator] Converted to Bedrock format:', JSON.stringify(tools, null, 2));
    }
    
    const maxTokens = req.config?.maxOutputTokens || 
                     req.generation_config?.max_output_tokens || 
                     req.generationConfig?.maxOutputTokens || 
                     8192;
    
    const temperature = req.config?.temperature ??
                       req.generation_config?.temperature ?? 
                       req.generationConfig?.temperature;
    
    const systemInstruction = req.config?.systemInstruction || 
                             req.system_instruction || 
                             req.systemInstruction;
    
    // Check if JSON mode is requested
    const isJsonMode = req.config?.responseMimeType === 'application/json';
    const responseSchema = req.config?.responseSchema;
    
    // Build the request object
    const bedrockRequest: Record<string, unknown> = {
      model: this.model,
      max_tokens: maxTokens,
      messages,
    };
    
    if (this.config.getDebugMode()) {
      console.debug('[BedrockContentGenerator] Model:', this.model);
      console.debug('[BedrockContentGenerator] Messages:', JSON.stringify(messages, null, 2));
    }
    
    if (tools.length > 0) {
      // AWS Bedrock Converse API uses toolConfig structure
      bedrockRequest.toolConfig = {
        tools: tools.map(tool => ({
          toolSpec: tool
        }))
      };
    }
    
    if (temperature !== undefined) {
      bedrockRequest.temperature = temperature;
    }
    
    let systemPrompt = '';
    if (systemInstruction) {
      systemPrompt = this.convertSystemInstruction(systemInstruction);
    }
    
    // For JSON mode, add strong instructions to the system prompt
    if (isJsonMode) {
      const jsonInstruction = 'You are a JSON-only assistant. Your entire response must be valid JSON. Do not include any text before or after the JSON. Do not include markdown code blocks. Start your response with { or [ and end with } or ].';
      if (responseSchema) {
        const schemaInstruction = `\nThe JSON must conform to this schema: ${JSON.stringify(responseSchema, null, 2)}`;
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${jsonInstruction}${schemaInstruction}` : `${jsonInstruction}${schemaInstruction}`;
      } else {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${jsonInstruction}` : jsonInstruction;
      }
    }
    
    if (systemPrompt) {
      bedrockRequest.system = systemPrompt;
    }
    
    if (this.config.getDebugMode()) {
      console.debug('[BedrockContentGenerator] Sending request to Bedrock:', JSON.stringify(bedrockRequest, null, 2));
    }
    
    const response = await this.client.messages.create(bedrockRequest as unknown as MessageCreateParamsNonStreaming);
    
    if (this.config.getDebugMode()) {
      console.debug('[BedrockContentGenerator] Received response:', JSON.stringify(response, null, 2));
    }

    return this.convertToGeminiResponse(response as Message as BedrockResponse, isJsonMode);
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const req = {...request} as ExtendedGenerateContentParameters;
    const messages = this.convertToAnthropicMessages(req.contents || []);
    const tools = this.convertToAnthropicTools(req.tools || []);
    
    if (this.config.getDebugMode() && tools.length > 0) {
      console.debug('[BedrockContentGenerator] Stream - Converting tools:', JSON.stringify(req.tools, null, 2));
      console.debug('[BedrockContentGenerator] Stream - Converted to Bedrock format:', JSON.stringify(tools, null, 2));
    }
    
    const maxTokens = req.generation_config?.max_output_tokens || 
                     req.generationConfig?.maxOutputTokens || 
                     8192;
    
    const temperature = req.generation_config?.temperature ?? 
                       req.generationConfig?.temperature;
    
    const systemInstruction = req.system_instruction || req.systemInstruction;
    
    // Build the request object
    const bedrockRequest: Record<string, unknown> = {
      model: this.model,
      max_tokens: maxTokens,
      messages,
      stream: true,
    };
    
    if (tools.length > 0) {
      // AWS Bedrock Converse API uses toolConfig structure
      bedrockRequest.toolConfig = {
        tools: tools.map(tool => ({
          toolSpec: tool
        }))
      };
    }
    
    if (temperature !== undefined) {
      bedrockRequest.temperature = temperature;
    }
    
    if (systemInstruction) {
      bedrockRequest.system = this.convertSystemInstruction(systemInstruction);
    }
    
    if (this.config.getDebugMode()) {
      console.debug('[BedrockContentGenerator] Stream - Sending request to Bedrock:', JSON.stringify(bedrockRequest, null, 2));
    }
    
    const stream = await this.client.messages.create(bedrockRequest as unknown as MessageCreateParamsStreaming);

    const generator = async function* (config: Config): AsyncGenerator<GenerateContentResponse> {
      let currentToolUse: { id?: string; name?: string; input?: unknown } = {};
      let accumulatedInput = '';
      
      for await (const chunk of stream as unknown as AsyncIterable<BedrockStreamChunk>) {
        if (config.getDebugMode()) {
          console.debug('[BedrockContentGenerator] Stream chunk:', JSON.stringify(chunk, null, 2));
        }
        
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
          yield {
            text: chunk.delta.text || '',
            candidates: [{
              index: 0,
              content: {
                role: 'model',
                parts: [{ text: chunk.delta.text || '' }],
              },
            }],
          } as GenerateContentResponse;
        } else if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
          // Start of a tool use block
          currentToolUse = {
            id: chunk.content_block.id,
            name: chunk.content_block.name,
            input: {},
          };
          accumulatedInput = '';
        } else if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'input_json_delta') {
          // Accumulate tool input JSON
          accumulatedInput += chunk.delta.input || '';
        } else if (chunk.type === 'content_block_stop' && currentToolUse.name) {
          // End of tool use block - parse and yield the complete tool call
          try {
            const parsedInput = accumulatedInput ? JSON.parse(accumulatedInput) : {};
            yield {
              candidates: [{
                index: 0,
                content: {
                  role: 'model',
                  parts: [{
                    functionCall: {
                      name: currentToolUse.name,
                      args: parsedInput,
                    },
                  }],
                },
              }],
            } as GenerateContentResponse;
          } catch (error) {
            console.error('[BedrockContentGenerator] Failed to parse tool input:', error);
          }
          // Reset for next tool use
          currentToolUse = {};
          accumulatedInput = '';
        }
      }
    };

    return generator(this.config);
  }

  async countTokens(_request: CountTokensParameters): Promise<CountTokensResponse> {
    const req = {..._request} as ExtendedGenerateContentParameters;
    const messages = this.convertToAnthropicMessages(req.contents || []);
    
    // Rough estimation: ~4 characters per token
    let totalChars = 0;
    for (const message of messages) {
      if (typeof message.content === 'string') {
        totalChars += message.content.length;
      } else {
        for (const block of message.content) {
          if ('text' in block && block.text) {
            totalChars += block.text.length;
          }
        }
      }
    }
    
    const estimatedTokens = Math.ceil(totalChars / 4);
    
    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // Bedrock doesn't support embeddings through the Anthropic models
    throw new Error('Embeddings are not supported with AWS Bedrock Claude models');
  }

  private convertToAnthropicMessages(contents: Content[]): BedrockMessage[] {
    const messages: BedrockMessage[] = [];
    
    for (const content of contents) {
      if (content.role === 'user' || content.role === 'model') {
        const anthropicContent = this.convertPartsToAnthropicContent(content.parts || []);
        messages.push({
          role: content.role === 'user' ? 'user' : 'assistant',
          content: anthropicContent,
        });
      }
    }
    
    return messages;
  }

  private convertPartsToAnthropicContent(parts: Part[]): string | BedrockContentBlock[] {
    if (parts.length === 1 && 'text' in parts[0] && parts[0].text) {
      return parts[0].text;
    }
    
    const blocks: BedrockContentBlock[] = [];
    
    for (const part of parts) {
      if ('text' in part && part.text) {
        blocks.push({ type: 'text', text: part.text });
      } else if ('inlineData' in part && part.inlineData) {
        blocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.inlineData.mimeType || 'image/jpeg',
            data: part.inlineData.data || '',
          },
        });
      } else if ('functionCall' in part && part.functionCall) {
        blocks.push({
          type: 'tool_use',
          id: `call_${Date.now()}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {},
        });
      } else if ('functionResponse' in part && part.functionResponse) {
        blocks.push({
          type: 'tool_result',
          tool_use_id: part.functionResponse.name,
          content: JSON.stringify(part.functionResponse.response),
        });
      }
    }
    
    return blocks;
  }

  private convertToAnthropicTools(tools: Tool[]): BedrockTool[] {
    const result: BedrockTool[] = [];
    if (!tools || tools.length === 0) {
      return result;
    }
    
    for (const tool of tools) {
      if (!tool.functionDeclarations) continue;
      
      for (const funcDecl of tool.functionDeclarations) {
        if (funcDecl && funcDecl.name) {
          const schema = funcDecl.parameters as Record<string, unknown> || {};
          // Ensure the schema has type: "object" as required by Bedrock
          if (!schema.type) {
            schema.type = 'object';
          }
          // Ensure properties exist even if empty
          if (!schema.properties) {
            schema.properties = {};
          }
          
          result.push({
            name: funcDecl.name,
            description: funcDecl.description || '',
            input_schema: schema,
          });
        }
      }
    }
    return result;
  }

  private convertSystemInstruction(instruction: Content | string): string {
    if (typeof instruction === 'string') {
      return instruction;
    }
    
    const parts = instruction.parts || [];
    return parts.map(part => 'text' in part ? part.text || '' : '').join('\n');
  }

  private convertToGeminiResponse(response: BedrockResponse, isJsonMode = false): GenerateContentResponse {
    const parts: Part[] = [];
    
    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        const text = block.text;
        // For JSON mode, verify the response is valid JSON
        if (isJsonMode) {
          try {
            // Try to parse to validate it's JSON, but return the original text
            JSON.parse(text);
          } catch (error) {
            // If JSON parsing fails in JSON mode, throw an error
            // This forces the caller to handle the invalid JSON response
            console.error('Bedrock returned invalid JSON in JSON mode:', text);
            throw new Error(`Bedrock API returned invalid JSON: ${error}`);
          }
        }
        parts.push({ text });
      } else if (block.type === 'tool_use' && block.name) {
        parts.push({
          functionCall: {
            name: block.name,
            args: block.input || {},
          },
        });
      }
    }
    
    // Create a response that satisfies the GenerateContentResponse interface
    const text = parts.find(p => 'text' in p && p.text)?.text || '';
    
    return {
      text,
      candidates: [{
        index: 0,
        content: {
          role: 'model',
          parts,
        },
      }],
      usageMetadata: {
        promptTokenCount: response.usage?.input_tokens || 0,
        candidatesTokenCount: response.usage?.output_tokens || 0,
        totalTokenCount: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      },
    } as GenerateContentResponse;
  }
}