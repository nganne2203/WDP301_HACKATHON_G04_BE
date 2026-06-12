import mongoose from 'mongoose'

const { Schema } = mongoose

const githubWebhookEventSchema = new Schema(
  {
    deliveryId: { type: String, required: true, trim: true },
    eventType: { type: String, required: true, trim: true },
    repositoryFullName: { type: String, trim: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    branch: { type: String, trim: true },
    beforeCommitSha: { type: String, trim: true },
    afterCommitSha: { type: String, trim: true },
    payload: { type: Schema.Types.Mixed, default: null },
    signatureValid: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ['REJECTED', 'IGNORED', 'RECEIVED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED'],
      default: 'RECEIVED'
    },
    errorMessage: { type: String, trim: true },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date }
  },
  { timestamps: true }
)

githubWebhookEventSchema.index({ deliveryId: 1 }, { unique: true })
githubWebhookEventSchema.index({ eventType: 1, status: 1 })
githubWebhookEventSchema.index({ repositoryFullName: 1, receivedAt: -1 })

const GitHubWebhookEvent = mongoose.model('GitHubWebhookEvent', githubWebhookEventSchema)

export default GitHubWebhookEvent
