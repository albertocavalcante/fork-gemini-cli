/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  UserTierId,
  DEFAULT_BEDROCK_SMALL_FAST_MODEL,
  DEFAULT_BEDROCK_MODEL,
  isProQuotaExceededError,
  isGenericQuotaExceededError,
  isApiError,
  isStructuredError,
} from '@google/gemini-cli-core';

// Bedrock Rate Limit messages
const getRateLimitErrorMessageBedrock = (
  fallbackModel: string = DEFAULT_BEDROCK_SMALL_FAST_MODEL,
) =>
  `\nRate limit detected. Switching to the ${fallbackModel} model for the rest of this session.`;

const getRateLimitErrorMessageBedrockQuota = (
  currentModel: string = DEFAULT_BEDROCK_MODEL,
  fallbackModel: string = DEFAULT_BEDROCK_SMALL_FAST_MODEL,
) =>
  `\nYou have reached your quota limit for ${currentModel}. You will be switched to the ${fallbackModel} model for the rest of this session.`;

/**
 * Parses a structured error and returns a user-friendly message based on the error type and auth method.
 */
export function parseStructuredError(
  error: unknown,
  authType?: AuthType,
  userTier?: UserTierId,
  modelSwitched?: boolean,
): string | null {
  if (!isApiError(error) || !isStructuredError(error)) {
    return null;
  }

  const status = (error as any).statusCode || (error as any).status;

  if (status === 429) {
    if (authType === AuthType.USE_AWS_BEDROCK) {
      if (isProQuotaExceededError(error) && !modelSwitched) {
        return getRateLimitErrorMessageBedrockQuota();
      } else if (isGenericQuotaExceededError(error)) {
        return getRateLimitErrorMessageBedrock();
      } else if (!modelSwitched) {
        return getRateLimitErrorMessageBedrock();
      }
    }
  }

  return null;
}

/**
 * Parses and formats an API error for display
 */
export function parseAndFormatApiError(
  error: unknown,
  authType?: AuthType,
  userTier?: UserTierId,
  modelSwitched?: boolean,
): string {
  const structuredMessage = parseStructuredError(error, authType, userTier, modelSwitched);
  if (structuredMessage) {
    return structuredMessage;
  }
  
  // Return generic error message
  return error instanceof Error ? error.message : 'An unknown error occurred';
}