#!/bin/bash

# Example script showing how to use Gemini CLI with LiteLLM and Amazon Bedrock

echo "Setting up Gemini CLI to use Amazon Bedrock through LiteLLM..."

# Step 1: Start LiteLLM proxy (in another terminal)
echo "Step 1: Start LiteLLM proxy in another terminal:"
echo "litellm --model bedrock/anthropic.claude-v2"
echo ""
echo "Press Enter when LiteLLM is running..."
read

# Step 2: Configure environment variables
export OPENAI_API_KEY="${LITELLM_API_KEY:-sk-1234}"  # Your LiteLLM key
export OPENAI_BASE_URL="http://localhost:4000/v1"
export OPENAI_MODEL="bedrock/anthropic.claude-v2"

echo "Environment configured:"
echo "OPENAI_API_KEY: ${OPENAI_API_KEY}"
echo "OPENAI_BASE_URL: ${OPENAI_BASE_URL}"
echo "OPENAI_MODEL: ${OPENAI_MODEL}"
echo ""

# Step 3: Run Gemini CLI
echo "Starting Gemini CLI..."
echo "Select 'OpenAI-compatible API' when prompted for authentication method"
echo ""

# Run gemini (assuming it's in PATH)
gemini