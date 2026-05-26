import mongoose from 'mongoose'

const { Schema } = mongoose

const scoreSchema = new Schema(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true },
    scoreSheetId: { type: Schema.Types.ObjectId, ref: 'ScoreSheet' },
    judgeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    criterionId: { type: Schema.Types.ObjectId, ref: 'Criterion' },
    aiReviewCriterionId: { type: Schema.Types.ObjectId, ref: 'AiReviewCriterion' },
    aiSuggestedScore: { type: Number },
    scoreValue: { type: Number, required: true },
    isOverridden: { type: Boolean, default: false },
    overrideReason: { type: String },
    comment: { type: String }
  },
  { timestamps: true }
)

scoreSchema.index({ submissionId: 1, judgeId: 1, criterionId: 1 }, { unique: true })
scoreSchema.index({ scoreSheetId: 1 })
scoreSchema.index({ judgeId: 1 })
scoreSchema.index({ aiReviewCriterionId: 1 })

const Score = mongoose.model('Score', scoreSchema)

export default Score
