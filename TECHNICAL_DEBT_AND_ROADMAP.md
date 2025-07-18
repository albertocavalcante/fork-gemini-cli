# Technical Debt and Development Roadmap

This document tracks technical debt, TODOs, and future improvements needed for the AWS Bedrock integration.

## 🚨 Critical Issues (P0 - Must Fix)

### 1. Type Safety Violations
**File:** `packages/core/src/core/bedrockContentGenerator.ts`
**Lines:** 136, 177
```typescript
// Current (BAD):
const response = await (this.client.messages.create as Function)(bedrockRequest);

// Should be:
const response = await this.client.messages.create(bedrockRequest as MessageCreateParams);
```
**Impact:** Bypasses TypeScript type checking, could hide runtime errors
**Effort:** Low (1-2 hours)

### 2. Tool Response ID Tracking Bug
**File:** `packages/core/src/core/bedrockContentGenerator.ts`
**Line:** 289
```typescript
// Current (WRONG):
tool_use_id: part.functionResponse.name, // This is incorrect!

// Need to implement:
private toolCallMap = new Map<string, string>(); // Map function name to tool_use_id
```
**Impact:** Tool responses won't be properly matched to tool calls
**Effort:** Medium (2-4 hours)

### 3. No Error Handling
**Files:** Multiple locations in `bedrockContentGenerator.ts`
- Constructor (no try-catch)
- API calls (no error wrapping)
- Stream processing (no error boundaries)
**Impact:** Unhandled errors will crash the application
**Effort:** Medium (4-6 hours)

### 4. Missing AWS Credential Validation
**File:** `packages/core/src/core/bedrockContentGenerator.ts`
```typescript
// Need to add:
constructor() {
  this.validateAWSConfiguration();
  // ... rest of constructor
}

private async validateAWSConfiguration() {
  try {
    // Test API call to validate credentials
    await this.client.models.list({ maxResults: 1 });
  } catch (error) {
    throw new Error(`Invalid AWS credentials or configuration: ${error.message}`);
  }
}
```
**Impact:** Errors occur at runtime instead of initialization
**Effort:** Low (1-2 hours)

## 🔧 Important Improvements (P1 - Production Readiness)

### 5. Restore Test Coverage
**Files:** All `*.test.ts` files
- `packages/core/src/core/contentGenerator.test.ts`
- `packages/core/src/code_assist/oauth2.test.ts`
- Multiple other test files
**Current State:** All tests are stubbed with `it.skip()`
**Needed:**
- Unit tests for BedrockContentGenerator
- Integration tests with mocked AWS client
- E2E tests with test AWS account
**Effort:** High (2-3 days)

### 6. Implement Proper Token Counting
**File:** `packages/core/src/core/bedrockContentGenerator.ts`
**Line:** 218
```typescript
// Current (too simplistic):
const estimatedTokens = Math.ceil(totalChars / 4);

// Should use:
import { get_encoding } from 'tiktoken';
const encoder = get_encoding('cl100k_base');
const tokens = encoder.encode(text).length;
```
**Impact:** Inaccurate token counts affect rate limiting and cost estimation
**Effort:** Medium (3-4 hours)

### 7. Extract Duplicated Code
**File:** `packages/core/src/core/bedrockContentGenerator.ts`
**Methods:** `generateContent` and `generateContentStream`
```typescript
private buildBedrockRequest(req: ExtendedGenerateContentParameters, streaming = false) {
  // Common logic here
}
```
**Impact:** Maintainability and potential for bugs
**Effort:** Low (2-3 hours)

### 8. Add Retry Logic
**File:** `packages/core/src/core/bedrockContentGenerator.ts`
```typescript
private async withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  backoffMs = 1000
): Promise<T> {
  // Implement exponential backoff
}
```
**Impact:** Transient AWS errors will cause failures
**Effort:** Medium (3-4 hours)

## 📈 Enhancements (P2 - Nice to Have)

### 9. Remove Hardcoded Type Definitions
**File:** `packages/core/src/core/bedrockContentGenerator.ts`
**Lines:** 23-82
- Research proper way to import types from `@anthropic-ai/bedrock-sdk`
- Or create a separate types package
**Effort:** Medium (4-6 hours)

### 10. Implement Connection Pooling
```typescript
class BedrockClientPool {
  private clients: Map<string, AnthropicBedrock>;
  
  getClient(region: string): AnthropicBedrock {
    // Implement client reuse
  }
}
```
**Impact:** Better performance and resource usage
**Effort:** Medium (4-6 hours)

### 11. Add Comprehensive Logging
- Add debug logging for all API calls
- Integrate with AWS CloudWatch
- Add performance metrics
**Effort:** Medium (6-8 hours)

### 12. Support Multiple AWS Profiles
```typescript
interface BedrockConfig {
  profile?: string;
  region: string;
  roleArn?: string;
}
```
**Effort:** Medium (4-6 hours)

### 13. Improve Model Configuration
**File:** `packages/core/src/config/models.ts`
- Move hardcoded model IDs to configuration file
- Support model aliases (e.g., "claude-3-sonnet" -> full model ID)
- Add model capability detection
**Effort:** Low (2-3 hours)

## 🚀 Future Considerations (P3)

### 14. Alternative Embedding Support
Since Bedrock Claude doesn't support embeddings:
- Integrate Amazon Titan Embeddings
- Add Amazon OpenSearch for vector storage
- Or remove embedding functionality entirely
**Effort:** High (1-2 weeks)

### 15. Streaming Improvements
- Support all streaming event types (not just text and tool_use)
- Add progress indicators
- Implement stream interruption/cancellation
**Effort:** Medium (1-2 days)

### 16. Security Enhancements
- Add request signing verification
- Implement rate limiting per AWS account
- Add audit logging with AWS CloudTrail integration
- Support AWS KMS for encryption
**Effort:** High (1-2 weeks)

### 17. Performance Optimizations
- Implement response caching
- Add request batching
- Optimize message format conversions
- Add performance benchmarks
**Effort:** High (1-2 weeks)

### 18. Developer Experience
- Add JSDoc comments to all public methods
- Create usage examples
- Add troubleshooting guide
- Create migration guide from Google auth
**Effort:** Medium (3-4 days)

## 📊 Technical Debt Metrics

| Category | Count | Estimated Hours |
|----------|-------|-----------------|
| Critical (P0) | 4 | 8-12 |
| Important (P1) | 4 | 30-40 |
| Enhancements (P2) | 5 | 22-32 |
| Future (P3) | 5 | 80-120 |
| **Total** | **18** | **140-204** |

## 🎯 Recommended Execution Order

### Phase 1: Critical Fixes (1 week)
1. Fix type safety violations (#1)
2. Fix tool response tracking (#2)
3. Add error handling (#3)
4. Add AWS validation (#4)

### Phase 2: Production Readiness (2-3 weeks)
5. Restore test coverage (#5)
6. Implement proper token counting (#6)
7. Extract duplicated code (#7)
8. Add retry logic (#8)

### Phase 3: Enhancements (2-3 weeks)
9. Fix type definitions (#9)
10. Add logging (#11)
11. Improve model configuration (#13)

### Phase 4: Future Features (1-2 months)
- Evaluate and implement based on user needs and feedback

## 🔍 Code Smells to Address

1. **Magic Numbers**: Hardcoded values like `8192` for max_tokens
2. **String Literals**: Model IDs should be in constants
3. **Type Assertions**: Multiple uses of `as` keyword
4. **Missing Documentation**: No JSDoc comments
5. **Inconsistent Error Messages**: Need standardized error format
6. **No Validation**: Input parameters aren't validated
7. **Memory Leaks**: Stream handlers might not clean up properly

## 📝 Additional Notes

- Consider creating a `@gemini-cli/bedrock` package to isolate AWS-specific code
- Need to update GitHub Actions CI/CD for AWS testing
- Should add AWS Cost estimation warnings
- Consider supporting AWS Bedrock Agents in the future
- May need to handle AWS service limits differently than Google's

## 🏁 Definition of Done

For each item:
- [ ] Code implemented with proper types
- [ ] Unit tests written and passing
- [ ] Integration tests where applicable
- [ ] Documentation updated
- [ ] Error cases handled
- [ ] Code reviewed
- [ ] No new linting errors