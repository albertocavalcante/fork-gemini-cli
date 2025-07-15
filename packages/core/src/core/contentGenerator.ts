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
} from '@google/genai';
import { Config } from '../config/config.js';
import { UserTierId } from '../code_assist/types.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  getTier?(): Promise<UserTierId | undefined>;
}

export enum AuthType {
  USE_AWS_BEDROCK = 'aws-bedrock',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
};

export async function createContentGeneratorConfig(
  model: string | undefined,
  authType: AuthType | undefined,
): Promise<ContentGeneratorConfig> {
  // Default to Bedrock model if not specified
  const DEFAULT_BEDROCK_MODEL = process.env.ANTHROPIC_MODEL || 'us.anthropic.claude-3-7-sonnet-20250219-v1:0';
  const effectiveModel = model || DEFAULT_BEDROCK_MODEL;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
  };

  if (authType === AuthType.USE_AWS_BEDROCK) {
    // AWS credentials are handled by the SDK through standard AWS credential chain
    // No API key needed here
    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  if (config.authType === AuthType.USE_AWS_BEDROCK) {
    // Lazy import to avoid loading if not needed
    const { BedrockContentGenerator } = await import('./bedrockContentGenerator.js');
    return new BedrockContentGenerator(config, gcConfig);
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
