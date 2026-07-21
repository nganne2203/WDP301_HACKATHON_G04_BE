import assert from 'node:assert/strict'
import test from 'node:test'

import { isWithinCompetitionDateWindow } from '../src/utils/competitionDateWindow.js'

const competition = {
  startDate: '2026-07-15T00:00:00.000Z',
  endDate: '2026-07-21T00:00:00.000Z'
}

test('competition date window is inclusive for the full final day in Vietnam time', () => {
  assert.equal(isWithinCompetitionDateWindow({ competition, value: '2026-07-15T00:00:00.000Z' }), true)
  assert.equal(isWithinCompetitionDateWindow({ competition, value: '2026-07-21T16:59:59.000Z' }), true)
  assert.equal(isWithinCompetitionDateWindow({ competition, value: '2026-07-14T16:59:59.000Z' }), false)
  assert.equal(isWithinCompetitionDateWindow({ competition, value: '2026-07-21T17:00:00.000Z' }), false)
})
