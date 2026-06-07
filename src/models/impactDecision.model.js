import mongoose from 'mongoose'

const { Schema } = mongoose

const impactDecisionSchema = new Schema(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    commitSha: { type: String, required: true, trim: true },
    impactScore: { type: Number, required: true },
    impactLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true
    },
    decision: {
      type: String,
      enum: ['SKIP_LLM', 'BATCH_HOURLY_AUDIT', 'CALL_PER_PUSH_AUDIT', 'URGENT_AUDIT_AND_HUMAN_REVIEW'],
      required: true
    },
    reasons: [{ type: String, trim: true }],
    needsHumanReview: { type: Boolean, default: false }
  },
  { timestamps: true }
)

impactDecisionSchema.index({ repositoryId: 1, commitSha: 1 }, { unique: true })

const ImpactDecision = mongoose.model('ImpactDecision', impactDecisionSchema)

export default ImpactDecision
