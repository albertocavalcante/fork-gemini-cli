/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { createContentGenerator, AuthType } from './contentGenerator.js';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { GoogleGenAI } from '@google/genai';
import { OpenAIContentGenerator } from './openaiContentGenerator.js';
import { DeepSeekContentGenerator } from './deepseekContentGenerator.js';

vi.mock('../code_assist/codeAssist.js');
vi.mock('@google/genai');
vi.mock('./openaiContentGenerator.js');
vi.mock('./deepseekContentGenerator.js');

describe('contentGenerator', () => {
  it('should create a CodeAssistContentGenerator', async () => {
    const mockGenerator = {} as unknown;
    vi.mocked(createCodeAssistContentGenerator).mockResolvedValue(
      mockGenerator as never,
    );
    const generator = await createContentGenerator({
      model: 'test-model',
      authType: AuthType.LOGIN_WITH_GOOGLE_PERSONAL,
    });
    expect(createCodeAssistContentGenerator).toHaveBeenCalled();
    expect(generator).toBe(mockGenerator);
  });

  it('should create a GoogleGenAI content generator', async () => {
    const mockGenerator = {
      models: {},
    } as unknown;
    vi.mocked(GoogleGenAI).mockImplementation(() => mockGenerator as never);
    const generator = await createContentGenerator({
      model: 'test-model',
      apiKey: 'test-api-key',
      authType: AuthType.USE_GEMINI,
    });
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      vertexai: undefined,
      httpOptions: {
        headers: {
          'User-Agent': expect.any(String),
        },
      },
    });
    expect(generator).toBe((mockGenerator as GoogleGenAI).models);
  });

  it('should create an OpenAIContentGenerator', async () => {
    const mockGenerator = {} as unknown;
    vi.mocked(OpenAIContentGenerator).mockImplementation(
      () => mockGenerator as never,
    );
    const generator = await createContentGenerator({
      model: 'gpt-4-turbo-preview',
      apiKey: 'test-openai-api-key',
      authType: AuthType.USE_OPENAI,
    });
    expect(OpenAIContentGenerator).toHaveBeenCalledWith(
      'test-openai-api-key',
      undefined,
      'gpt-4-turbo-preview',
    );
    expect(generator).toBe(mockGenerator);
  });

  it('should create an OpenAIContentGenerator with custom base URL', async () => {
    const mockGenerator = {} as unknown;
    vi.mocked(OpenAIContentGenerator).mockImplementation(
      () => mockGenerator as never,
    );
    
    // Set environment variable for base URL
    process.env.OPENAI_BASE_URL = 'https://custom.openai.com/v1';
    
    const generator = await createContentGenerator({
      model: 'gpt-4',
      apiKey: 'test-api-key',
      authType: AuthType.USE_OPENAI,
    });
    
    expect(OpenAIContentGenerator).toHaveBeenCalledWith(
      'test-api-key',
      'https://custom.openai.com/v1',
      'gpt-4',
    );
    expect(generator).toBe(mockGenerator);
    
    // Clean up
    delete process.env.OPENAI_BASE_URL;
  });

  it('should create a DeepSeekContentGenerator', async () => {
    const mockGenerator = {} as unknown;
    vi.mocked(DeepSeekContentGenerator).mockImplementation(
      () => mockGenerator as never,
    );
    const generator = await createContentGenerator({
      model: 'deepseek-chat',
      apiKey: 'test-deepseek-api-key',
      authType: AuthType.USE_DEEPSEEK,
    });
    expect(DeepSeekContentGenerator).toHaveBeenCalledWith(
      'test-deepseek-api-key',
    );
    expect(generator).toBe(mockGenerator);
  });

  it('should throw error for OpenAI without API key', async () => {
    await expect(
      createContentGenerator({
        model: 'gpt-4',
        authType: AuthType.USE_OPENAI,
      }),
    ).rejects.toThrow('OpenAI API key is required');
  });
});
