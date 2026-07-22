import mongoose from 'mongoose'
import dns from 'node:dns'

import { env } from '#configs/environment.js'
import Team from '#models/team.model.js'

dns.setServers(['8.8.8.8', '1.1.1.1'])

const INDEXES_TO_DROP = [
  'competitionId_1_name_1',
  'competitionId_1_normalizedName_1',
  'competitionId_1_leaderId_1'
]

async function dropIndexIfExists(collection, indexName) {
  const indexes = await collection.indexes()
  if (!indexes.some(index => index.name === indexName)) return
  await collection.dropIndex(indexName)
  console.log(`Dropped index ${indexName}`)
}

async function main() {
  if (!env.db.uri) {
    throw new Error('MONGODB_URI is required')
  }

  await mongoose.connect(env.db.uri)
  for (const indexName of INDEXES_TO_DROP) {
    await dropIndexIfExists(Team.collection, indexName)
  }

  await Team.createIndexes()
  console.log('Created active-team partial indexes')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
