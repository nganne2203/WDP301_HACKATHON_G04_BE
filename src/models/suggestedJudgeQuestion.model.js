import mongoose from 'mongoose'

const { Schema } = mongoose

const suggestedJudgeQuestionSchema = new Schema(
  {
    aiReviewId: { type: Schema.Types.ObjectId, ref: 'AiReview', required: true },
    question: { type: String, required: true, trim: true },
    relatedCriterionId: { type: Schema.Types.ObjectId, ref: 'Criterion' },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' }
  },
  { timestamps: true }
)

suggestedJudgeQuestionSchema.index({ aiReviewId: 1, priority: 1 })

const SuggestedJudgeQuestion = mongoose.model('SuggestedJudgeQuestion', suggestedJudgeQuestionSchema)

export default SuggestedJudgeQuestion
