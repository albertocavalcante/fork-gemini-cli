/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createContentGeneratorConfig, AuthType } from './contentGenerator.js';

vi.mock('./modelCheck.js', () => ({
  getEffectiveModel: vi
    .fn()
    .mockImplementation((apiKey, model) => Promise.resolve(model)),
}));

describe('createContentGeneratorConfig - OpenAI API support', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('OpenAI configuration', () => {
    it('should use OPENAI_API_KEY from environment', async () => {
      process.env.OPENAI_API_KEY = 'env-openai-key';

      const config = await createContentGeneratorConfig(
        'gpt-4',
        AuthType.USE_OPENAI,
      );

      expect(config.apiKey).toBe('env-openai-key');
      expect(config.model).toBe('gpt-4');
      expect(config.authType).toBe(AuthType.USE_OPENAI);
    });

    it('should use default OpenAI model when not specified', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const config = await createContentGeneratorConfig(
        undefined,
        AuthType.USE_OPENAI,
      );

      expect(config.model).toBe('gpt-4-turbo-preview');
    });

    it('should replace Gemini default model with OpenAI default', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const config = await createContentGeneratorConfig(
        'gemini-2.5-pro', // Default Gemini model
        AuthType.USE_OPENAI,
      );

      expect(config.model).toBe('gpt-4-turbo-preview');
    });

    it('should respect custom OpenAI model', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const config = await createContentGeneratorConfig(
        'gpt-4-turbo',
        AuthType.USE_OPENAI,
      );

      expect(config.model).toBe('gpt-4-turbo');
    });

    it('should not return config without API key', async () => {
      delete process.env.OPENAI_API_KEY;

      const config = await createContentGeneratorConfig(
        'gpt-4',
        AuthType.USE_OPENAI,
      );

      // When no API key is present, the config is not populated for OpenAI
      expect(config.apiKey).toBeUndefined();
    });

    it('should handle OPENAI_BASE_URL environment variable', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.OPENAI_BASE_URL = 'https://custom.openai.com/v1';

      const config = await createContentGeneratorConfig(
        'gpt-4',
        AuthType.USE_OPENAI,
      );

      // Note: OPENAI_BASE_URL is used when creating the generator, not stored in config
      expect(config.apiKey).toBe('test-key');
      expect(config.model).toBe('gpt-4');
    });
  });
});
