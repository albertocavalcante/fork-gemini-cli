# AC-Code Fork Changelog

## Overview

This is a fork of Google's Gemini CLI that has been modified to work exclusively with AWS Bedrock for accessing Claude models. This fork is maintained for use cases where AWS Bedrock is the preferred or required method for accessing Anthropic's Claude models.

## Key Differences from Upstream

### 1. AWS Bedrock Integration (Primary Change)
- **Removed**: All Google Gemini API integrations
- **Added**: AWS Bedrock as the sole model provider
- **Default Model**: Claude 3.7 Sonnet via cross-region inference profile
- **Authentication**: Uses AWS credentials (IAM, profiles, etc.) instead of API keys

### 2. Configurable Config Directory
- **Added**: Support for `GEMINI_CONFIG_DIR` environment variable
- **Default**: Still uses `.gemini` for backward compatibility
- **Usage**: `export GEMINI_CONFIG_DIR=.ac-code` to use custom directory
- **Benefit**: Allows separation of fork config from upstream Gemini CLI

### 3. Enhanced MCP (Model Context Protocol) Support
- **Added**: Debug logging for MCP tool discovery
- **Added**: Better error handling for MCP server connections
- **Feature**: Supports all MCP-compatible tools with AWS Bedrock

## Installation & Setup

### Prerequisites
1. AWS Account with Bedrock access enabled
2. Claude model access granted in AWS Bedrock console
3. AWS CLI configured with appropriate credentials

### Quick Start
```bash
# Clone the fork
git clone [your-fork-url]
cd fork-gemini-cli
npm install
npm run build

# Configure AWS credentials
export AWS_PROFILE=bedrock
export AWS_REGION=us-east-1

# Optional: Use custom config directory
export GEMINI_CONFIG_DIR=.ac-code

# Run the CLI
npm start
```

## Configuration

### Environment Variables
- `AWS_PROFILE`: AWS profile to use (default: uses AWS credential chain)
- `AWS_REGION`: AWS region (default: us-east-1)
- `GEMINI_CONFIG_DIR`: Config directory name (default: .gemini)

### Settings File
Located at `~/$GEMINI_CONFIG_DIR/settings.json`:
```json
{
  "selectedAuthType": "aws-bedrock"
}
```

## Available Models

### Claude Models (via Inference Profiles)
- Claude 3.7 Sonnet: `us.anthropic.claude-3-7-sonnet-20250219-v1:0`
- Claude Sonnet 4: `us.anthropic.claude-sonnet-4-20250514-v1:0`
- Claude Opus 4: `us.anthropic.claude-opus-4-20250514-v1:0`
- Claude 3 Haiku: `anthropic.claude-3-haiku-20240307-v1:0`

### Amazon Models
- Titan Text Lite: `amazon.titan-text-lite-v1`
- Nova Micro: `amazon.nova-micro-v1:0`
- Nova Pro: `amazon.nova-pro-v1:0`

## Migration from Upstream

If you're migrating from the original Gemini CLI:

1. **Backup existing config**: `cp -r ~/.gemini ~/.gemini.backup`
2. **Set custom config directory**: `export GEMINI_CONFIG_DIR=.ac-code`
3. **Configure AWS credentials**: See AWS Setup section
4. **Update model references**: Replace Gemini model IDs with Bedrock model IDs

## Testing

Test scripts are available in the `bedrock/` directory:
```bash
cd bedrock
npm install
npm run test-all  # Test all SDK approaches
npm run test-inference  # Test inference profiles
```

## Known Limitations

1. **No Google Gemini Support**: This fork only supports AWS Bedrock
2. **Cross-Region Inference**: Some models require inference profiles
3. **AWS Costs**: Usage incurs AWS Bedrock charges

## Contributing

When contributing to this fork:
1. Keep changes minimal to ease upstream merges
2. Use conventional commits
3. Document AWS-specific features
4. Test with multiple Claude models

## Version History

### v0.1.12-bedrock.3 (2025-07-20)
- feat(config): Make config directory configurable via environment variable
- fix(bedrock): Resolve TypeScript compilation errors
- feat(mcp): Add debug logging for MCP tool discovery

### v0.1.12-bedrock.2 (Previous)
- feat: Integrate AWS Bedrock as sole model provider
- fix: Improve environment variable handling
- fix(bedrock): Enable tool calling and improve JSON mode handling

### v0.1.12-bedrock.1 (Initial Fork)
- Initial fork from google-gemini/gemini-cli v0.1.12
- Remove Google Gemini integrations
- Add AWS Bedrock support

## Resources

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Anthropic Claude on Bedrock](https://docs.anthropic.com/en/api/claude-on-amazon-bedrock)
- [Original Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [Bedrock Inference Profiles Guide](./bedrock/INFERENCE_PROFILES.md)