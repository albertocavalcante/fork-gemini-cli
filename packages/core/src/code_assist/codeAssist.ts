/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, ContentGenerator } from '../core/contentGenerator.js';
import { Config } from '../config/config.js';

export async function createCodeAssistContentGenerator(
  httpOptions: any,
  authType: AuthType,
  config: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  // This function is no longer used as we only support AWS Bedrock
  throw new Error('Google authentication is no longer supported. Use AWS Bedrock instead.');
}
