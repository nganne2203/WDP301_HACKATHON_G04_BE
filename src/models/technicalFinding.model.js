import mongoose from 'mongoose'

const { Schema } = mongoose

const technicalFindingSchema = new Schema(
  {
    aiReviewId: { type: Schema.Types.ObjectId, ref: 'AiReview', required: true },
    type: {
      type: String,
      enum: ['ARCHITECTURE', 'SECURITY', 'RELIABILITY', 'PERFORMANCE', 'TESTING', 'AI_USAGE', 'RAG', 'AGENT', 'DEPENDENCY', 'MAINTAINABILITY']
    },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
    title: { type: String, required: true, trim: true },
    evidence: [{ type: String, trim: true }],
    comment: { type: String },
    recommendedAction: { type: String }
  },
  { timestamps: true }
)

technicalFindingSchema.index({ aiReviewId: 1, severity: 1 })

const TechnicalFinding = mongoose.model('TechnicalFinding', technicalFindingSchema)

export default TechnicalFinding
