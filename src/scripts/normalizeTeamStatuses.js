/* eslint-disable no-console */
import mongoose from 'mongoose'

import { env } from '#configs/environment.js'
import Team from '#models/team.model.js'

const LEGACY_TO_WORKFLOW_STATUS = {
  PENDING: 'WAITING_FOR_MEMBERS',
  ACTIVE: 'CONFIRMED',
  INACTIVE: 'REJECTED',
  DISQUALIFIED: 'REJECTED'
}

const REJECTED_MIGRATION_REASONS = {
  INACTIVE: 'Migrated from legacy INACTIVE status.',
  DISQUALIFIED: 'Migrated from legacy DISQUALIFIED status.'
}

const connect = async () => {
  if (!env.db?.uri) {
    throw new Error('MONGODB_URI is not set')
  }

  await mongoose.connect(env.db.uri)
}

const buildMigrationUpdate = (team, now = new Date()) => {
  const nextStatus = LEGACY_TO_WORKFLOW_STATUS[team.status]
  if (!nextStatus) return null

  const update = {
    status: nextStatus
  }

  if (team.status === 'ACTIVE' && !team.confirmedAt) {
    update.confirmedAt = team.updatedAt || team.createdAt || now
  }

  if (nextStatus === 'REJECTED') {
    update.rejectedAt = team.rejectedAt || now
    update.rejectionReason = team.rejectionReason || REJECTED_MIGRATION_REASONS[team.status] || 'Migrated from a legacy rejected-equivalent status.'
  }

  return update
}

const run = async () => {
  await connect()

  try {
    const teams = await Team.collection.find({
      status: { $in: Object.keys(LEGACY_TO_WORKFLOW_STATUS) }
    }).toArray()

    if (teams.length === 0) {
      console.log('No legacy team statuses found.')
      return
    }

    const operations = teams
      .map((team) => {
        const update = buildMigrationUpdate(team)
        if (!update) return null

        return {
          updateOne: {
            filter: { _id: team._id },
            update: { $set: update }
          }
        }
      })
      .filter(Boolean)

    if (operations.length > 0) {
      await Team.collection.bulkWrite(operations)
    }

    console.log(`Normalized ${operations.length} team record(s).`)
  } finally {
    await mongoose.disconnect()
  }
}

run().catch((error) => {
  console.error('Failed to normalize team statuses:', error)
  process.exitCode = 1
})
