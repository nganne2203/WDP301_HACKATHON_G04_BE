import { CONNECT_DB, CLOSE_DB } from '#configs/mongodb.js'
import mongoose from 'mongoose'
import '#models/aiReview.model.js'
import '#models/technicalFinding.model.js'

async function main() {
  await CONNECT_DB()
  try {
    const review = await mongoose.model('AiReview').findOne({}).sort({ requestedAt: -1 })
    if (!review) {
      console.log('No reviews found.')
      return
    }

    console.log('--- Review Overview ---')
    console.log(JSON.stringify({
      id: review._id,
      status: review.status,
      lastError: review.lastError,
      completedAt: review.completedAt,
      modelName: review.modelName,
      summary: review.summary,
      overallSummary: review.overallSummary
    }, null, 2))

    console.log('--- Normalized Output ---')
    console.log(JSON.stringify(review.normalizedOutput, null, 2))

    // Find technical findings associated with this review
    const findings = await mongoose.model('TechnicalFinding').find({ aiReviewId: review._id })
    console.log(`--- Technical Findings (${findings.length}) ---`)
    console.log(JSON.stringify(findings, null, 2))
  } catch (error) {
    console.error(error)
  } finally {
    await CLOSE_DB()
    process.exit(0)
  }
}
main()
