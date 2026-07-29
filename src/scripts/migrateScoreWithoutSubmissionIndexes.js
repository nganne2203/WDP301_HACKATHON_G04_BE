import mongoose from 'mongoose'

import { env } from '#configs/environment.js'
import Score from '#models/score.model.js'

const LEGACY_INDEX = 'submissionId_1_judgeId_1_criterionId_1'

async function main() {
  await mongoose.connect(env.db.uri)
  const indexes = await Score.collection.indexes()
  if (indexes.some(index => index.name === LEGACY_INDEX)) {
    await Score.collection.dropIndex(LEGACY_INDEX)
    console.log(`Dropped ${LEGACY_INDEX}`)
  }
  await Score.createIndexes()
  console.log('Created score-sheet criterion index')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
