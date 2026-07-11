import { CONNECT_DB, CLOSE_DB } from '#configs/mongodb.js'
import mongoose from 'mongoose'
import { AI_REVIEW_SERVICE } from '#modules/ai-reviews/ai-review.service.js'

// Import models so they register with mongoose
import '#models/user.model.js'
import '#models/repository.model.js'
import '#models/event.model.js'
import '#models/round.model.js'
import '#models/rubric.model.js'
import '#models/criterion.model.js'
import '#models/aiReview.model.js'
import '#models/aiReviewCriterion.model.js'
import '#models/technicalFinding.model.js'
import '#models/auditLog.model.js'

async function main() {
  await CONNECT_DB()
  try {
    const repo = await mongoose.model('Repository').findOne({ repositoryFullName: { $exists: true, $ne: null } })
    if (!repo) {
      console.log('No repository with valid repositoryFullName found in database.')
      return
    }
    console.log('Found repository:', repo._id, repo.repositoryFullName)

    const user = await mongoose.model('User').findOne({ roles: { $exists: true } })
    if (!user) {
      console.log('No user found in database.')
      return
    }
    console.log('Using requester user:', user._id, user.email)

    const result = await AI_REVIEW_SERVICE.createPerPushAudit({
      repositoryId: repo._id.toString(),
      commitSha: repo.latestCommitSha || 'main',
      beforeCommitSha: repo.latestCommitSha === '8cc55293a79db0c526e5ae5e9fc070addbdce043' ? '1667d7ef02ca99ec02b330e0af3dede1ffb1ae7c' : undefined,
      requestedBy: user._id.toString(),
      source: 'manual'
    })

    console.log('Audit requested successfully:', result)
  } catch (error) {
    console.error('Error triggering audit:', error)
  } finally {
    await CLOSE_DB()
    process.exit(0)
  }
}

main()
