import assert from 'node:assert/strict'
import test from 'node:test'

import { createAiRuntimeService } from '../src/services/ai-runtime.service.js'

test('AI runtime retries transient provider failures and returns extracted JSON text', async () => {
  let callCount = 0
  const service = createAiRuntimeService({
    config: {
      provider: 'openai',
      baseUrl: 'https://example.test/v1',
      apiKey: 'test-key',
      model: 'mock-model',
      repairModel: 'mock-model',
      timeoutMs: 1000,
      maxRetries: 1
    },
    fetchImpl: async () => {
      callCount += 1
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          async text() {
            return 'temporary failure'
          }
        }
      }

      return {
        ok: true,
        async json() {
          return {
            model: 'mock-model',
            choices: [{
              message: {
                content: '{"status":"DONE"}'
              }
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15
            }
          }
        }
      }
    }
  })

  const result = await service.generateAudit({
    reviewKind: 'PER_PUSH_TECHNICAL_AUDIT',
    promptInput: { hello: 'world' }
  })

  assert.equal(callCount, 2)
  assert.equal(result.rawResponse, '{"status":"DONE"}')
  assert.equal(result.provider, 'openai')
  assert.equal(result.tokenUsage.total_tokens, 15)
})
