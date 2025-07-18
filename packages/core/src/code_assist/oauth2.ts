/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '../core/contentGenerator.js';
import { Config } from '../config/config.js';

// Stub file - OAuth is no longer supported

export interface OauthWebLogin {
  authUrl: string;
  loginCompletePromise: Promise<void>;
}

export async function getOauthClient(
  authType: AuthType,
  config: Config,
): Promise<any> {
  throw new Error('Google OAuth authentication is no longer supported. Use AWS Bedrock instead.');
}

export async function clearCachedCredentialFile(): Promise<void> {
  // No-op - no cached credentials for Bedrock
}

export function getCachedGoogleAccount(): string | null {
  return null;
}