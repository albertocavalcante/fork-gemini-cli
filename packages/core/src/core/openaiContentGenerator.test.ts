/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIContentGenerator } from './openaiContentGenerator.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('OpenAIContentGenerator', () => {
  let generator: OpenAIContentGenerator;
  const mockApiKey = 'test-openai-api-key';

  beforeEach(() => {
    generator = new OpenAIContentGenerator(mockApiKey);
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create with default base URL', () => {
      const gen = new OpenAIContentGenerator(mockApiKey);
      expect(gen).toBeDefined();
    });

    it('should create with custom base URL', () => {
      const customUrl = 'https://custom.openai.azure.com/';
      const gen = new OpenAIContentGenerator(mockApiKey, customUrl);
      expect(gen).toBeDefined();
    });

    it('should create with custom model', () => {
      const gen = new OpenAIContentGenerator(mockApiKey, undefined, 'gpt-4');
      expect(gen).toBeDefined();
    });
  });

  describe('generateContent', () => {
    it('should make proper API call to OpenAI', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello from OpenAI!',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const request = {
        model: 'gpt-4-turbo-preview',
        contents: [
          {
            role: 'user' as const,
            parts: [{ text: 'Hello OpenAI' }],
          },
        ],
      };

      const result = await generator.generateContent(request);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
        }),
      );

      expect(result.candidates).toBeDefined();
      expect(result.candidates![0]?.content?.parts?.[0]?.text).toBe(
        'Hello from OpenAI!',
      );
    });

    it('should use custom base URL when provided', async () => {
      const customBaseUrl = 'https://my-azure-openai.openai.azure.com/openai/deployments/gpt-4';
      const customGenerator = new OpenAIContentGenerator(mockApiKey, customBaseUrl, 'gpt-4');

      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Response from Azure',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const request = {
        model: 'gpt-4',
        contents: 'Test with custom URL',
      };

      await customGenerator.generateContent(request);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://my-azure-openai.openai.azure.com/openai/deployments/gpt-4/chat/completions',
        expect.any(Object),
      );
    });
  });

  describe('embedContent', () => {
    it('should use OpenAI embeddings endpoint', async () => {
      const mockEmbeddingResponse = {
        data: [
          {
            embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          },
        ],
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmbeddingResponse),
      });

      const result = await generator.embedContent({
        model: 'text-embedding-3-small',
        contents: 'Test embedding text',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: 'Test embedding text',
          }),
        }),
      );

      expect(result.embeddings![0].values).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should handle embedding errors', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Invalid API key'),
      });

      await expect(generator.embedContent({ model: 'text-embedding-3-small', contents: 'Test' })).rejects.toThrow(
        'OpenAI API error: 401 Unauthorized - Invalid API key',
      );
    });

    it('should extract text from content parts', async () => {
      const mockEmbeddingResponse = {
        data: [
          {
            embedding: [0.1, 0.2, 0.3],
          },
        ],
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmbeddingResponse),
      });

      const result = await generator.embedContent({
        model: 'text-embedding-3-small',
        contents: {
          parts: [{ text: 'Text from parts' }],
          role: 'user',
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: 'Text from parts',
          }),
        }),
      );

      expect(result.embeddings![0].values).toEqual([0.1, 0.2, 0.3]);
    });

    it('should throw error for non-OpenAI endpoints', async () => {
      const customGenerator = new OpenAIContentGenerator(
        mockApiKey,
        'https://custom-api.example.com/v1',
      );

      await expect(
        customGenerator.embedContent({ model: 'text-embedding-3-small', contents: 'Test' }),
      ).rejects.toThrow(
        'This OpenAI-compatible API endpoint may not support embeddings',
      );
    });
  });

  describe('generateContentStream', () => {
    it('should handle streaming responses properly', async () => {
      const mockChunks = [
        { choices: [{ delta: { content: 'Hello' }, finish_reason: null }] },
        { choices: [{ delta: { content: ' world' }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: 'stop' }] },
      ];

      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          mockChunks.forEach((chunk) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
            );
          });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const request = {
        model: 'gpt-4-turbo-preview',
        contents: [{ role: 'user' as const, parts: [{ text: 'Stream test' }] }],
      };

      const stream = await generator.generateContentStream(request);
      const responses = [];

      for await (const response of stream) {
        responses.push(response);
      }

      expect(responses.length).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('"stream":true'),
        }),
      );
    });
  });

  describe('countTokens', () => {
    it('should return token count approximation', async () => {
      const request = {
        model: 'gpt-4-turbo-preview',
        contents: [
          {
            role: 'user' as const,
            parts: [{ text: 'Count these tokens please' }],
          },
        ],
      };

      const result = await generator.countTokens(request);

      // Should return an approximation based on text length
      expect(result.totalTokens).toBeGreaterThan(0);
    });
  });
});
