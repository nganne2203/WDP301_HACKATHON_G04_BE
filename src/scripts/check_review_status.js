import { CONNECT_DB, CLOSE_DB } from '#configs/mongodb.js'
import mongoose from 'mongoose'
import '#models/aiReview.model.js'

async function main() {
  await CONNECT_DB()
  try {
    const review = await mongoose.model('AiReview').findOne({}).sort({ requestedAt: -1 })
    console.log('Current review state:', {
      id: review?._id,
      status: review?.status,
      lastError: review?.lastError,
      completedAt: review?.completedAt,
      modelName: review?.modelName
    })
  } catch (error) {
    console.error(error)
  } finally {
    await CLOSE_DB()
    process.exit(0)
  }
}
main()
