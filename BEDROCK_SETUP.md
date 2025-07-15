# AWS Bedrock Integration for Gemini CLI

This fork of Gemini CLI has been modified to work exclusively with AWS Bedrock for accessing Claude models.

## Prerequisites

1. AWS Account with Bedrock access
2. AWS CLI installed and configured (optional, but recommended)
3. Access to Claude models in AWS Bedrock

## Setup

### 1. Enable Claude Models in AWS Bedrock

1. Go to the AWS Bedrock console
2. Navigate to "Model access"
3. Request access to Claude models (e.g., Claude 3 Sonnet, Claude 3 Haiku, Claude 3 Opus)
4. Wait for approval (usually immediate for Claude models)

### 2. Configure AWS Credentials

Choose one of the following methods:

#### Option A: Environment Variables
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1  # or your preferred region
```

#### Option B: AWS CLI Configuration
```bash
aws configure
```

#### Option C: IAM Role (for EC2/Lambda)
No additional configuration needed if running on AWS infrastructure with proper IAM roles.

### 3. Set Required Environment Variables

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1  # Required
```

### 4. (Optional) Customize Model Selection

```bash
# Default models are already configured, but you can override:
export ANTHROPIC_MODEL='us.anthropic.claude-3-7-sonnet-20250219-v1:0'
export ANTHROPIC_SMALL_FAST_MODEL='us.anthropic.claude-3-5-haiku-20241022-v1:0'
```

## Usage

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the CLI
npm start
```

## Available Models

- **Claude 3 Sonnet** (Default): `us.anthropic.claude-3-7-sonnet-20250219-v1:0`
- **Claude 3 Haiku** (Fast/Small): `us.anthropic.claude-3-5-haiku-20241022-v1:0`
- **Claude 3 Opus** (Most capable): `us.anthropic.claude-opus-4-20250514-v1:0`

## Troubleshooting

### "AWS_REGION environment variable not found"
Make sure to set the AWS_REGION environment variable:
```bash
export AWS_REGION=us-east-1
```

### "CLAUDE_CODE_USE_BEDROCK must be set to 1"
Enable Bedrock mode:
```bash
export CLAUDE_CODE_USE_BEDROCK=1
```

### "Access denied" or credential errors
Ensure your AWS credentials have the necessary permissions for Bedrock:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:*:*:model/anthropic.claude-*"
    }
  ]
}
```

## Key Differences from Original Gemini CLI

1. **Authentication**: Only AWS Bedrock authentication is supported (no Google OAuth, API keys, or Vertex AI)
2. **Models**: Uses Claude models instead of Gemini models
3. **No embeddings**: Claude models don't support embeddings through Bedrock
4. **Simplified auth flow**: No login/logout commands needed

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAUDE_CODE_USE_BEDROCK` | Yes | Must be set to `1` |
| `AWS_REGION` | Yes | AWS region (e.g., `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | Optional* | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Optional* | AWS secret key |
| `ANTHROPIC_MODEL` | Optional | Override default model |
| `ANTHROPIC_SMALL_FAST_MODEL` | Optional | Override fast model |

*Required unless using AWS CLI profile or IAM roles