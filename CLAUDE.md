# Important Guidelines for Claude

## TypeScript Best Practices

### NEVER Use `any` Type
- **NEVER** use `any` type in TypeScript code
- Always use proper type definitions or interfaces
- If type is unknown, use `unknown` and add proper type guards
- For complex types, create proper interfaces or type aliases

### Code Quality Standards
- Always run `npm run lint` before considering code complete
- Always run `npm run typecheck` to ensure type safety
- Fix all linting errors without using `any` type as a shortcut

## Project-Specific Guidelines

### AWS Bedrock Integration
- The Anthropic SDK's `messages.create` method returns a typed response
- Use proper type imports from '@anthropic-ai/bedrock-sdk'
- Tool format must match AWS Bedrock Converse API specification

### MCP Tools Integration
- Tools are passed through `generationConfig` in GeminiChat
- AWS Bedrock requires `toolConfig` structure, not direct `tools` array
- Always add debug logging for tool discovery and conversion