import mongoose from 'mongoose'

const { Schema } = mongoose

const aiReviewSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    commitId: { type: Schema.Types.ObjectId, ref: 'Commit' },
    commitDiffId: { type: Schema.Types.ObjectId, ref: 'CommitDiff' },
    impactDecisionId: { type: Schema.Types.ObjectId, ref: 'ImpactDecision' },
    reviewKind: {
      type: String,
      enum: ['PER_PUSH_TECHNICAL_AUDIT', 'TEAM_AGGREGATE_TECHNICAL_AUDIT'],
      default: 'PER_PUSH_TECHNICAL_AUDIT'
    },
    provider: { type: String },
    model: { type: String },
    modelName: { type: String },
    promptVersion: { type: String, default: 'v1' },
    promptInput: { type: Schema.Types.Mixed, default: null },
    rawResponse: { type: String },
    normalizedOutput: { type: Schema.Types.Mixed, default: null },
    tokenUsage: { type: Schema.Types.Mixed, default: null },
    commitSha: { type: String, trim: true },
    batchId: { type: String, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'SKIPPED', 'COMPLETED', 'FAILED', 'FALLBACK'],
      default: 'PENDING'
    },
    isScoreBased: { type: Boolean, default: false },
    isFinalDecision: { type: Boolean, default: false },
    needsHumanReview: { type: Boolean, default: false },
    summary: { type: String },
    overallSummary: { type: String },
    techStackDetected: { type: Schema.Types.Mixed, default: null },
    riskSummary: [{ type: Schema.Types.Mixed }],
    details: { type: Schema.Types.Mixed },
    score: { type: Number },
    retryCount: { type: Number, default: 0 },
    lastError: { type: String },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date },
    completedAt: { type: Date }
  },
  { timestamps: true }
)

aiReviewSchema.index({ repositoryId: 1, requestedAt: 1 })
aiReviewSchema.index({ commitDiffId: 1 })
aiReviewSchema.index({ status: 1 })
aiReviewSchema.index({ repositoryId: 1, reviewKind: 1, createdAt: -1 })
aiReviewSchema.index({ teamId: 1, reviewKind: 1, createdAt: -1 })
aiReviewSchema.index({ repositoryId: 1, commitSha: 1, reviewKind: 1 })

const AiReview = mongoose.model('AiReview', aiReviewSchema)

export default AiReview
