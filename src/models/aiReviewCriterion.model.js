import mongoose from 'mongoose'

const { Schema } = mongoose

const aiReviewCriterionSchema = new Schema(
  {
    aiReviewId: { type: Schema.Types.ObjectId, ref: 'AiReview', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    description: { type: String },
    maxScore: { type: Number, default: 0 },
    weight: { type: Number, default: 1 },
    feedback: { type: String },
    qualitativeLevel: {
      type: String,
      enum: ['EXCELLENT', 'GOOD', 'FAIR', 'AVERAGE', 'WEAK', 'NOT_ENOUGH_EVIDENCE']
    },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    suggestions: [{ type: String }],
    evidence: [{ type: String }],
    risks: [{ type: String }],
    order: { type: Number, default: 0 },
    criterionId: { type: Schema.Types.ObjectId, ref: 'Criterion' }
  },
  { timestamps: true }
)

aiReviewCriterionSchema.index({ aiReviewId: 1, order: 1 })
aiReviewCriterionSchema.index({ aiReviewId: 1, code: 1 })

const AiReviewCriterion = mongoose.model('AiReviewCriterion', aiReviewCriterionSchema)

export default AiReviewCriterion
