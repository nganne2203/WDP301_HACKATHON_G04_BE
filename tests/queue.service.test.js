import assert from 'node:assert/strict'
import test from 'node:test'

import { buildQueueJobId } from '../src/services/queue.service.js'

test('buildQueueJobId sanitizes BullMQ-forbidden separators from job ids', () => {
  const jobId = buildQueueJobId('fetch-commit-diff', 'delivery:001', 'repo/name', 'sha value')

  assert.equal(jobId, 'fetch-commit-diff__delivery_001__repo_name__sha_value')
  assert.equal(jobId.includes(':'), false)
})
