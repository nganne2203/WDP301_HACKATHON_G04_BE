import mongoose from 'mongoose'

const { Schema } = mongoose

const suggestedTestCaseSchema = new Schema(
  {
    aiReviewId: { type: Schema.Types.ObjectId, ref: 'AiReview', required: true },
    title: { type: String, required: true, trim: true },
    purpose: { type: String },
    expectedObservation: { type: String },
    relatedCriterionId: { type: Schema.Types.ObjectId, ref: 'Criterion' }
  },
  { timestamps: true }
)

suggestedTestCaseSchema.index({ aiReviewId: 1 })

const SuggestedTestCase = mongoose.model('SuggestedTestCase', suggestedTestCaseSchema)

export default SuggestedTestCase
