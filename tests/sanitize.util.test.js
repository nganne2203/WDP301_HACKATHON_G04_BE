import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSafeSearchRegex, normalizeSearchTerm } from '../src/utils/sanitizeUtil.js'

test('buildSafeSearchRegex escapes regex metacharacters and limits search length', () => {
  const pattern = buildSafeSearchRegex('[team](alpha)+'.repeat(20), { maxLength: 12 })

  assert.equal(normalizeSearchTerm('x'.repeat(120)).length, 100)
  assert.equal(pattern.test('teamalpha'), false)
  assert.equal(pattern.test('[team](alpha)+'), true)
  assert.equal(pattern.test('[TEAM](ALPHA)+'), true)
})
