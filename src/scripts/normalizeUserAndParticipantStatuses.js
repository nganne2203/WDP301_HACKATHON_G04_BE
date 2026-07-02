/* eslint-disable no-console */
import mongoose from 'mongoose'

import { env } from '#configs/environment.js'
import Participant from '#models/participant.model.js'
import User from '#models/user.model.js'

const connect = async () => {
  if (!env.db?.uri) {
    throw new Error('MONGODB_URI is not set')
  }

  await mongoose.connect(env.db.uri)
}

const normalizeUsers = async () => {
  const result = await User.collection.updateMany(
    { status: 'APPROVED' },
    { $set: { status: 'ACTIVE' } }
  )

  return result.modifiedCount || 0
}

const normalizeParticipants = async () => {
  const result = await Participant.collection.updateMany(
    { status: 'ACTIVE' },
    { $set: { status: 'JOINED' } }
  )

  return result.modifiedCount || 0
}

const run = async () => {
  await connect()

  try {
    const [updatedUsers, updatedParticipants] = await Promise.all([
      normalizeUsers(),
      normalizeParticipants()
    ])

    console.log(`Normalized ${updatedUsers} user account status record(s).`)
    console.log(`Normalized ${updatedParticipants} participant status record(s).`)
  } finally {
    await mongoose.disconnect()
  }
}

run().catch((error) => {
  console.error('Failed to normalize user/participant statuses:', error)
  process.exitCode = 1
})
