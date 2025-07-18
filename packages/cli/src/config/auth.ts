/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@google/gemini-cli-core';
import { loadEnvironment } from './settings.js';

export const validateAuthMethod = (authMethod: string): string | null => {
  loadEnvironment();
  
  if (authMethod === AuthType.USE_AWS_BEDROCK) {
    // Check if we have AWS credentials configured
    if (!process.env.AWS_REGION) {
      return 'AWS_REGION environment variable not found. Set your AWS region (e.g., us-east-1) and try again!';
    }
    
    // AWS credentials can come from multiple sources (env vars, AWS CLI, IAM roles)
    // So we don't strictly require AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
    
    return null;
  }

  return 'Invalid auth method selected. Only AWS Bedrock is supported.';
};
