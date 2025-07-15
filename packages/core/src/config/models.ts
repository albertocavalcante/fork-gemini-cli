/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// AWS Bedrock Claude model IDs - defaults
export const DEFAULT_BEDROCK_MODEL = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0';
export const DEFAULT_BEDROCK_SMALL_FAST_MODEL = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';
export const DEFAULT_BEDROCK_OPUS_MODEL = 'us.anthropic.claude-opus-4-20250514-v1:0';

// Functions to get models with environment variable overrides
export function getDefaultBedrockModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_BEDROCK_MODEL;
}

export function getDefaultBedrockSmallFastModel(): string {
  return process.env.ANTHROPIC_SMALL_FAST_MODEL || DEFAULT_BEDROCK_SMALL_FAST_MODEL;
}

export function getDefaultBedrockOpusModel(): string {
  return process.env.ANTHROPIC_OPUS_MODEL || DEFAULT_BEDROCK_OPUS_MODEL;
}

// Legacy exports for compatibility (will be removed)
export const DEFAULT_GEMINI_MODEL = DEFAULT_BEDROCK_MODEL;
export const DEFAULT_GEMINI_FLASH_MODEL = DEFAULT_BEDROCK_SMALL_FAST_MODEL;
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'not-supported';
