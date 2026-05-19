import mongoose from 'mongoose'

const { Schema } = mongoose

const aiReviewSchema = new Schema(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    commitId: { type: Schema.Types.ObjectId, ref: 'Commit' },
    provider: { type: String },
    model: { type: String },
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    summary: { type: String },
    details: { type: Schema.Types.Mixed },
    score: { type: Number },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date },
    completedAt: { type: Date }
  },
  { timestamps: true }
)

aiReviewSchema.index({ repositoryId: 1, requestedAt: 1 })
aiReviewSchema.index({ status: 1 })

const AiReview = mongoose.model('AiReview', aiReviewSchema)

export default AiReview
