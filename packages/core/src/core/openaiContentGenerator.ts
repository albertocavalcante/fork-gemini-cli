/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Content,
  Part,
  ContentListUnion,
  PartUnion,
  FunctionDeclaration,
  FinishReason,
} from '@google/genai';
import { ContentGenerator } from './contentGenerator.js';
import { DEFAULT_OPENAI_MODEL } from '../config/models.js';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const OPENAI_EMBEDDINGS_MODEL = 'text-embedding-3-small';

/**
 * Helper function to convert ContentListUnion to Content[]
 */
function toContents(contents: ContentListUnion): Content[] {
  if (Array.isArray(contents)) {
    // it's a Content[] or a PartUnion[]
    return contents.map(toContent);
  }
  // it's a Content or a PartUnion
  return [toContent(contents)];
}

function toContent(content: Content | PartUnion): Content {
  if (Array.isArray(content)) {
    // This shouldn't happen in our context, but handle it
    throw new Error('Array content not supported in this context');
  }
  if (typeof content === 'string') {
    // it's a string
    return {
      role: 'user',
      parts: [{ text: content }],
    };
  }
  if (typeof content === 'object' && content !== null && 'parts' in content) {
    // it's a Content
    return content;
  }
  // it's a Part
  return {
    role: 'user',
    parts: [content as Part],
  };
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  tools?: OpenAITool[];
  tool_choice?:
    | 'auto'
    | 'none'
    | { type: 'function'; function: { name: string } };
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

/**
 * OpenAI Content Generator that implements the OpenAI API specification
 * Supports OpenAI's native API as well as any OpenAI-compatible endpoints
 */
export class OpenAIContentGenerator implements ContentGenerator {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(apiKey: string, baseUrl?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || OPENAI_BASE_URL).replace(/\/$/, ''); // Remove trailing slash
    this.defaultModel = model || DEFAULT_OPENAI_MODEL;
  }

  /**
   * Convert Gemini Content format to OpenAI messages format
   */
  private convertToOpenAIMessages(contents: Content[]): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];

    for (const content of contents) {
      const role =
        content.role === 'model'
          ? 'assistant'
          : (content.role as 'system' | 'user');
      const parts = content.parts || [];

      // Handle function calls in assistant messages
      const functionCalls = parts.filter(
        (part: Part) =>
          typeof part === 'object' && part !== null && 'functionCall' in part,
      );

      // Handle function responses in user messages
      const functionResponses = parts.filter(
        (part: Part) =>
          typeof part === 'object' &&
          part !== null &&
          'functionResponse' in part,
      );

      const textParts = parts.filter(
        (part: Part): part is { text: string } =>
          typeof part === 'object' && part !== null && 'text' in part,
      );

      if (functionCalls.length > 0) {
        // Convert Gemini function calls to OpenAI tool_calls
        const tool_calls = functionCalls.map((part, index: number) => {
          const functionCall = (
            part as {
              functionCall: {
                id?: string;
                name: string;
                args?: Record<string, unknown>;
              };
            }
          ).functionCall;
          return {
            id: functionCall.id || `call_${Date.now()}_${index}`,
            type: 'function' as const,
            function: {
              name: functionCall.name,
              arguments: JSON.stringify(functionCall.args || {}),
            },
          };
        });

        const combinedText = textParts
          .map((part: { text: string }) => part.text)
          .join('\n');
        messages.push({
          role,
          content: combinedText || null,
          tool_calls,
        });
      } else if (functionResponses.length > 0) {
        // Convert function responses to tool result messages
        for (const part of functionResponses) {
          const functionResponse = (
            part as {
              functionResponse: { response: unknown; id: string; name: string };
            }
          ).functionResponse;
          messages.push({
            role: 'tool',
            content: JSON.stringify(functionResponse.response),
            tool_call_id: functionResponse.id,
          });
        }
      } else if (textParts.length > 0) {
        const combinedText = textParts
          .map((part: { text: string }) => part.text)
          .join('\n');
        messages.push({
          role,
          content: combinedText,
        });
      }
    }

    return messages;
  }

  /**
   * Map OpenAI finish reasons to Gemini finish reasons
   */
  private mapFinishReason(
    openAIReason: string,
  ): FinishReason | undefined {
    switch (openAIReason) {
      case 'stop':
        return FinishReason.STOP;
      case 'length':
        return FinishReason.MAX_TOKENS;
      case 'content_filter':
        return FinishReason.SAFETY;
      case 'tool_calls':
        return FinishReason.STOP; // Tool calls are considered a normal stop
      default:
        return FinishReason.OTHER;
    }
  }

  /**
   * Convert Gemini function declarations to OpenAI tools format
   */
  private convertToOpenAITools(
    functionDeclarations?: FunctionDeclaration[],
  ): OpenAITool[] {
    if (!functionDeclarations) return [];

    return functionDeclarations.map((declaration) => ({
      type: 'function' as const,
      function: {
        name: declaration.name || 'unknown_function',
        description: declaration.description || '',
        parameters: (declaration.parameters as Record<string, unknown>) || {},
      },
    }));
  }

  /**
   * Convert OpenAI response to Gemini format
   */
  private convertToGeminiResponse(
    response: OpenAIResponse,
  ): GenerateContentResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No choices in OpenAI API response');
    }

    const geminiResponse = new GenerateContentResponse();

    // Handle tool calls in the response
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const parts = [];

      // Add text content if present
      if (choice.message.content) {
        parts.push({ text: choice.message.content });
      }

      // Add function calls
      const functionCalls = choice.message.tool_calls.map((toolCall) => ({
        functionCall: {
          id: toolCall.id,
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments || '{}'),
        },
      }));
      parts.push(...functionCalls);

      geminiResponse.candidates = [
        {
          content: {
            parts,
            role: 'model',
          },
          finishReason: this.mapFinishReason(choice.finish_reason),
          index: 0,
          safetyRatings: [],
        },
      ];

      // Add functionCalls property using defineProperty to bypass readonly
      const functionCallsArray = choice.message.tool_calls.map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.function.name,
        args: JSON.parse(toolCall.function.arguments || '{}'),
      }));

      Object.defineProperty(geminiResponse, 'functionCalls', {
        value: functionCallsArray,
        writable: false,
        enumerable: true,
        configurable: true,
      });

      return geminiResponse;
    } else {
      // Regular text response
      geminiResponse.candidates = [
        {
          content: {
            parts: [{ text: choice.message.content || '' }],
            role: 'model',
          },
          finishReason: this.mapFinishReason(choice.finish_reason),
          index: 0,
          safetyRatings: [],
        },
      ];
    }

    geminiResponse.usageMetadata = {
      promptTokenCount: response.usage.prompt_tokens,
      candidatesTokenCount: response.usage.completion_tokens,
      totalTokenCount: response.usage.total_tokens,
    };

    return geminiResponse;
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const contentsArray = toContents(request.contents);
    const messages = this.convertToOpenAIMessages(contentsArray);

    // Extract tools from config if available
    const allDeclarations: FunctionDeclaration[] = [];
    if (request.config?.tools) {
      for (const tool of request.config.tools) {
        // Handle different tool types from @google/genai
        if (
          'functionDeclarations' in tool &&
          Array.isArray(tool.functionDeclarations)
        ) {
          allDeclarations.push(...tool.functionDeclarations);
        }
      }
    }
    const openaiTools = this.convertToOpenAITools(allDeclarations);

    const openaiRequest: OpenAIRequest = {
      model: this.defaultModel,
      messages,
      stream: false,
      temperature: request.config?.temperature,
      max_tokens: request.config?.maxOutputTokens,
      top_p: request.config?.topP,
      ...(openaiTools.length > 0 && {
        tools: openaiTools,
        tool_choice: 'auto',
      }),
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(openaiRequest),
      signal: request.config?.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data: OpenAIResponse = await response.json();
    return this.convertToGeminiResponse(data);
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const contentsArray = toContents(request.contents);
    const messages = this.convertToOpenAIMessages(contentsArray);

    // Extract tools from config if available
    const allDeclarations: FunctionDeclaration[] = [];
    if (request.config?.tools) {
      for (const tool of request.config.tools) {
        // Handle different tool types from @google/genai
        if (
          'functionDeclarations' in tool &&
          Array.isArray(tool.functionDeclarations)
        ) {
          allDeclarations.push(...tool.functionDeclarations);
        }
      }
    }
    const openaiTools = this.convertToOpenAITools(allDeclarations);

    const openaiRequest: OpenAIRequest = {
      model: this.defaultModel,
      messages,
      stream: true,
      temperature: request.config?.temperature,
      max_tokens: request.config?.maxOutputTokens,
      top_p: request.config?.topP,
      ...(openaiTools.length > 0 && {
        tools: openaiTools,
        tool_choice: 'auto',
      }),
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(openaiRequest),
      signal: request.config?.abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const mapFinishReason = this.mapFinishReason.bind(this);
    const generator =
      async function* (): AsyncGenerator<GenerateContentResponse> {
        // State for accumulating tool calls across chunks
        const accumulatedToolCalls = new Map<
          number,
          {
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }
        >();
        let accumulatedContent = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed === '' || trimmed === 'data: [DONE]') continue;

              if (trimmed.startsWith('data: ')) {
                try {
                  const jsonStr = trimmed.slice(6);
                  const chunk: OpenAIStreamChunk = JSON.parse(jsonStr);

                  if (chunk.choices && chunk.choices[0]) {
                    const choice = chunk.choices[0];

                    // Handle content delta
                    if (choice.delta.content) {
                      accumulatedContent += choice.delta.content;

                      const geminiResponse = new GenerateContentResponse();
                      geminiResponse.candidates = [
                        {
                          content: {
                            parts: [{ text: choice.delta.content }],
                            role: 'model',
                          },
                          finishReason: mapFinishReason(
                            choice.finish_reason || 'other',
                          ),
                          index: 0,
                          safetyRatings: [],
                        },
                      ];

                      yield geminiResponse;
                    }

                    // Handle tool calls delta
                    if (choice.delta.tool_calls) {
                      for (const toolCallDelta of choice.delta.tool_calls) {
                        const index = toolCallDelta.index ?? 0;

                        if (!accumulatedToolCalls.has(index)) {
                          accumulatedToolCalls.set(index, {});
                        }

                        const accumulated = accumulatedToolCalls.get(index)!;

                        if (toolCallDelta.id) {
                          accumulated.id = toolCallDelta.id;
                        }
                        if (toolCallDelta.type) {
                          accumulated.type = toolCallDelta.type;
                        }
                        if (toolCallDelta.function) {
                          if (!accumulated.function) {
                            accumulated.function = {};
                          }
                          if (toolCallDelta.function.name) {
                            accumulated.function.name =
                              (accumulated.function.name || '') +
                              toolCallDelta.function.name;
                          }
                          if (toolCallDelta.function.arguments) {
                            accumulated.function.arguments =
                              (accumulated.function.arguments || '') +
                              toolCallDelta.function.arguments;
                          }
                        }
                      }
                    }

                    // Check if stream is finished
                    if (choice.finish_reason && choice.finish_reason !== null) {
                      // If we have accumulated tool calls, send them
                      if (accumulatedToolCalls.size > 0) {
                        const parts = [];

                        // Add accumulated content if any
                        if (accumulatedContent) {
                          parts.push({ text: accumulatedContent });
                        }

                        // Add completed tool calls
                        const functionCalls = Array.from(
                          accumulatedToolCalls.values(),
                        )
                          .filter(
                            (toolCall) =>
                              toolCall.id && toolCall.function?.name,
                          )
                          .map((toolCall) => ({
                            functionCall: {
                              id: toolCall.id!,
                              name: toolCall.function!.name!,
                              args: JSON.parse(
                                toolCall.function!.arguments || '{}',
                              ),
                            },
                          }));

                        parts.push(...functionCalls);

                        const geminiResponse = new GenerateContentResponse();
                        geminiResponse.candidates = [
                          {
                            content: {
                              parts,
                              role: 'model',
                            },
                            finishReason: mapFinishReason(
                              choice.finish_reason || 'other',
                            ),
                            index: 0,
                            safetyRatings: [],
                          },
                        ];

                        // Add functionCalls property using defineProperty to bypass readonly
                        const functionCallsArray = Array.from(
                          accumulatedToolCalls.values(),
                        )
                          .filter(
                            (toolCall) =>
                              toolCall.id && toolCall.function?.name,
                          )
                          .map((toolCall) => ({
                            id: toolCall.id!,
                            name: toolCall.function!.name!,
                            args: JSON.parse(
                              toolCall.function!.arguments || '{}',
                            ),
                          }));

                        Object.defineProperty(geminiResponse, 'functionCalls', {
                          value: functionCallsArray,
                          writable: false,
                          enumerable: true,
                          configurable: true,
                        });

                        yield geminiResponse;
                      } else {
                        // Send a final empty response with the finish reason to signal completion
                        const geminiResponse = new GenerateContentResponse();
                        geminiResponse.candidates = [
                          {
                            content: {
                              parts: [],
                              role: 'model',
                            },
                            finishReason: mapFinishReason(
                              choice.finish_reason || 'other',
                            ),
                            index: 0,
                            safetyRatings: [],
                          },
                        ];

                        yield geminiResponse;
                      }
                      return; // End the generator
                    }
                  }
                } catch (_parseError) {
                  console.warn('Failed to parse streaming chunk:', trimmed);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      };

    return generator();
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    const contentsArray = toContents(request.contents);

    // Most OpenAI-compatible APIs don't have a dedicated token counting endpoint
    // We'll estimate based on the text length (rough approximation: 4 chars per token)
    const messages = this.convertToOpenAIMessages(contentsArray);
    const totalText = messages.map((m) => m.content || '').join(' ');
    const estimatedTokens = Math.ceil(totalText.length / 4);

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Check if we're using the native OpenAI endpoint
    const isNativeOpenAI =
      this.baseUrl === OPENAI_BASE_URL ||
      this.baseUrl === 'https://api.openai.com/v1';

    if (!isNativeOpenAI) {
      // Non-OpenAI endpoints might not support embeddings
      throw new Error(
        'This OpenAI-compatible API endpoint may not support embeddings. ' +
          'Please use native OpenAI or Gemini for embedding operations.',
      );
    }

    // Extract text from the request
    let text = '';
    if (typeof request.contents === 'string') {
      text = request.contents;
    } else if (Array.isArray(request.contents)) {
      const firstContent = request.contents[0];
      if (
        firstContent &&
        typeof firstContent === 'object' &&
        'parts' in firstContent &&
        firstContent.parts?.[0]
      ) {
        const firstPart = firstContent.parts[0];
        if (firstPart && typeof firstPart === 'object' && 'text' in firstPart) {
          text = (firstPart as { text: string }).text;
        }
      }
    } else if (
      request.contents &&
      typeof request.contents === 'object' &&
      'parts' in request.contents
    ) {
      const firstPart = request.contents.parts?.[0];
      if (firstPart && typeof firstPart === 'object' && 'text' in firstPart) {
        text = (firstPart as { text: string }).text;
      }
    }

    if (!text) {
      text = ''; // Ensure text is never undefined
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDINGS_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();

    return {
      embeddings: [
        {
          values: data.data[0].embedding,
        },
      ],
    };
  }
}
