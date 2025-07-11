/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import {
  createContentGenerator,
  AuthType,
  createContentGeneratorConfig,
} from './contentGenerator.js';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { GoogleGenAI } from '@google/genai';
import { OpenAIContentGenerator } from './openaiContentGenerator.js';
import { DeepSeekContentGenerator } from './deepseekContentGenerator.js';
import { Config } from '../config/config.js';

vi.mock('../code_assist/codeAssist.js');
vi.mock('@google/genai');
vi.mock('./openaiContentGenerator.js');
vi.mock('./deepseekContentGenerator.js');

const mockConfig = {} as unknown as Config;

describe('createContentGenerator', () => {
  it('should create a CodeAssistContentGenerator', async () => {
    const mockGenerator = {} as unknown;
    vi.mocked(createCodeAssistContentGenerator).mockResolvedValue(
      mockGenerator as never,
    );
    const generator = await createContentGenerator(
      {
        model: 'test-model',
        authType: AuthType.LOGIN_WITH_GOOGLE,
      },
      mockConfig,
    );
    expect(createCodeAssistContentGenerator).toHaveBeenCalled();
    expect(generator).toBe(mockGenerator);
  });

  it('should create a GoogleGenAI content generator', async () => {
    const mockGenerator = {
      models: {},
    } as unknown;
    vi.mocked(GoogleGenAI).mockImplementation(() => mockGenerator as never);
    const generator = await createContentGenerator(
      {
        model: 'test-model',
        apiKey: 'test-api-key',
        authType: AuthType.USE_GEMINI,
      },
      mockConfig,
    );
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
    const generator = await createContentGenerator(
      {
        model: 'gpt-4-turbo-preview',
        apiKey: 'test-openai-api-key',
        authType: AuthType.USE_OPENAI,
      },
      mockConfig,
    );
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
    
    const generator = await createContentGenerator(
      {
        model: 'gpt-4',
        apiKey: 'test-api-key',
        authType: AuthType.USE_OPENAI,
      },
      mockConfig,
    );
    
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
    const generator = await createContentGenerator(
      {
        model: 'deepseek-chat',
        apiKey: 'test-deepseek-api-key',
        authType: AuthType.USE_DEEPSEEK,
      },
      mockConfig,
    );
    expect(DeepSeekContentGenerator).toHaveBeenCalledWith(
      'test-deepseek-api-key',
    );
    expect(generator).toBe(mockGenerator);
  });

  it('should throw error for OpenAI without API key', async () => {
    await expect(
      createContentGenerator(
        {
          model: 'gpt-4',
          authType: AuthType.USE_OPENAI,
        },
        mockConfig,
      ),
    ).rejects.toThrow('OpenAI API key is required');
  });
});

describe('createContentGeneratorConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to re-evaluate imports and environment variables
    vi.resetModules();
    // Restore process.env before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original process.env after all tests
    process.env = originalEnv;
  });

  it('should configure for Gemini using GEMINI_API_KEY when set', async () => {
    process.env.GEMINI_API_KEY = 'env-gemini-key';
    const config = await createContentGeneratorConfig(
      undefined,
      AuthType.USE_GEMINI,
    );
    expect(config.apiKey).toBe('env-gemini-key');
    expect(config.vertexai).toBe(false);
  });

  it('should not configure for Gemini if GEMINI_API_KEY is empty', async () => {
    process.env.GEMINI_API_KEY = '';
    const config = await createContentGeneratorConfig(
      undefined,
      AuthType.USE_GEMINI,
    );
    expect(config.apiKey).toBeUndefined();
    expect(config.vertexai).toBeUndefined();
  });

  it('should configure for Vertex AI using GOOGLE_API_KEY when set', async () => {
    process.env.GOOGLE_API_KEY = 'env-google-key';
    const config = await createContentGeneratorConfig(
      undefined,
      AuthType.USE_VERTEX_AI,
    );
    expect(config.apiKey).toBe('env-google-key');
    expect(config.vertexai).toBe(true);
  });

  it('should configure for Vertex AI using GCP project and location when set', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'env-gcp-project';
    process.env.GOOGLE_CLOUD_LOCATION = 'env-gcp-location';
    const config = await createContentGeneratorConfig(
      undefined,
      AuthType.USE_VERTEX_AI,
    );
    expect(config.vertexai).toBe(true);
    expect(config.apiKey).toBeUndefined();
  });

  it('should not configure for Vertex AI if required env vars are empty', async () => {
    process.env.GOOGLE_API_KEY = '';
    process.env.GOOGLE_CLOUD_PROJECT = '';
    process.env.GOOGLE_CLOUD_LOCATION = '';
    const config = await createContentGeneratorConfig(
      undefined,
      AuthType.USE_VERTEX_AI,
    );
    expect(config.apiKey).toBeUndefined();
    expect(config.vertexai).toBeUndefined();
  });
});
