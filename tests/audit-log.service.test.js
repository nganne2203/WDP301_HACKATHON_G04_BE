import assert from 'node:assert/strict'
import test from 'node:test'

import { createAuditLogService } from '../src/modules/audit-logs/audit-log.service.js'

test('audit log service returns paginated logs and summary breakdowns', async () => {
  const repository = {
    async findAuditLogs({ skip, limit }) {
      assert.equal(skip, 0)
      assert.equal(limit, 10)

      return [
        {
          _id: '664c3f6a3a6d4a5f3f93b911',
          userId: { _id: '664c3f6a3a6d4a5f3f93b922' },
          action: 'RESULTS_PUBLISHED',
          resourceType: 'Ranking',
          resourceId: '664c3f6a3a6d4a5f3f93b933',
          metadata: { roundId: '664c3f6a3a6d4a5f3f93b944' },
          createdAt: new Date('2026-06-08T08:00:00.000Z')
        }
      ]
    },
    async countAuditLogs() {
      return 1
    },
    async aggregateByAction() {
      return [{ action: 'RESULTS_PUBLISHED', count: 1 }]
    },
    async aggregateByResourceType() {
      return [{ resourceType: 'Ranking', count: 1 }]
    }
  }

  const service = createAuditLogService({ repository })

  const listed = await service.listAuditLogs({})
  assert.equal(listed.auditLogs.length, 1)
  assert.equal(listed.auditLogs[0].action, 'RESULTS_PUBLISHED')
  assert.equal(listed.pagination.totalItems, 1)

  const summary = await service.getAuditLogSummary({})
  assert.equal(summary.totalItems, 1)
  assert.equal(summary.actionBreakdown[0].action, 'RESULTS_PUBLISHED')
  assert.equal(summary.resourceBreakdown[0].resourceType, 'Ranking')
  assert.equal(summary.recentAuditLogs[0].userId, '664c3f6a3a6d4a5f3f93b922')
})
