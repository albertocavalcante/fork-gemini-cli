# Using the OpenAI API Specification with Gemini CLI

Gemini CLI supports the OpenAI API specification, enabling compatibility with:
- OpenAI (native support)
- Azure OpenAI Service
- LiteLLM (gateway to multiple providers including Amazon Bedrock)
- OpenRouter
- Any service implementing the OpenAI API specification

## Configuration

Set the following environment variables:

```bash
# Required
export OPENAI_API_KEY="your-api-key"

# Optional - only needed for non-OpenAI endpoints (e.g., Azure, LiteLLM)
export OPENAI_BASE_URL="https://your-api-endpoint.com/v1"

# Optional - defaults to gpt-4-turbo-preview
export OPENAI_MODEL="your-model-name"
```

## Examples

### Using with Native OpenAI

For native OpenAI, you only need the API key:

```bash
export OPENAI_API_KEY="your-openai-key"
# OPENAI_BASE_URL is not needed for native OpenAI
```

### Using with Azure OpenAI

```bash
export OPENAI_API_KEY="your-azure-api-key"
export OPENAI_BASE_URL="https://your-resource.openai.azure.com/openai/deployments/your-deployment"
export OPENAI_MODEL="gpt-4"
```

### Using with LiteLLM and Amazon Bedrock

1. Start LiteLLM proxy:
```bash
litellm --model bedrock/anthropic.claude-v2
```

2. Configure Gemini CLI:
```bash
export OPENAI_API_KEY="your-litellm-key"
export OPENAI_BASE_URL="http://localhost:4000/v1"
export OPENAI_MODEL="bedrock/anthropic.claude-v2"
```

3. Run Gemini CLI:
```bash
gemini
```

### Using with OpenRouter

```bash
export OPENAI_API_KEY="your-openrouter-key"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export OPENAI_MODEL="anthropic/claude-3-opus"
```

## Authentication

When you run Gemini CLI, select "OpenAI API Key" from the authentication menu. This option works for all OpenAI API specification-compatible services.

## Features Supported

- ✅ Chat completions (streaming and non-streaming)
- ✅ Function calling / Tool use
- ✅ Token counting (estimated)
- ✅ Embeddings (only with native OpenAI endpoints)

## Troubleshooting

1. **Authentication Error**: Ensure your `OPENAI_API_KEY` is correct
2. **Wrong Endpoint**: For non-OpenAI services, verify `OPENAI_BASE_URL` is set correctly
3. **Model Not Found**: Check that `OPENAI_MODEL` matches a valid model name for your service
4. **Embeddings Not Supported**: Embedding operations are only available with native OpenAI endpoints