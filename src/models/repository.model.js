import mongoose from 'mongoose'

const { Schema } = mongoose

const repositorySchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
    githubOwner: { type: String, trim: true },
    githubRepo: { type: String, trim: true },
    repositoryFullName: { type: String, trim: true },
    repositoryUrl: { type: String, trim: true },
    githubOrg: { type: String },
    repoName: { type: String },
    repoUrl: { type: String, required: true },
    contributors: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    defaultBranch: { type: String },
    latestCommitSha: { type: String, trim: true },
    lastProcessedCommitSha: { type: String, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'ARCHIVED', 'DISCONNECTED'],
      default: 'ACTIVE'
    },
    accessState: {
      type: String,
      enum: ['UNKNOWN', 'PENDING', 'GRANTED', 'REVOKED'],
      default: 'UNKNOWN'
    },
    submissionStatus: {
      type: String,
      enum: ['NOT_SUBMITTED', 'SUBMITTED', 'APPROVED'],
      default: 'NOT_SUBMITTED'
    },
    lastSyncAt: { type: Date },
    accessGrantedAt: { type: Date },
    accessRevokedAt: { type: Date },
    webhookRegisteredAt: { type: Date },
    webhookStatus: {
      type: String,
      enum: ['NOT_CONFIGURED', 'PENDING', 'REGISTERED', 'FAILED'],
      default: 'NOT_CONFIGURED'
    },
    lastWebhookRegistrationError: { type: String, trim: true }
  },
  { timestamps: true }
)

repositorySchema.pre('validate', function syncLegacyRepositoryFields(next) {
  if (!this.githubOwner && this.githubOrg) this.githubOwner = this.githubOrg
  if (!this.githubRepo && this.repoName) this.githubRepo = this.repoName
  if (!this.repositoryUrl && this.repoUrl) this.repositoryUrl = this.repoUrl
  if (!this.repoUrl && this.repositoryUrl) this.repoUrl = this.repositoryUrl
  if (!this.githubOrg && this.githubOwner) this.githubOrg = this.githubOwner
  if (!this.repoName && this.githubRepo) this.repoName = this.githubRepo

  if (!this.repositoryFullName && this.githubOwner && this.githubRepo) {
    this.repositoryFullName = `${this.githubOwner}/${this.githubRepo}`
  }

  next()
})

repositorySchema.index({ teamId: 1 }, { unique: true })
repositorySchema.index({ repoUrl: 1 }, { unique: true })
repositorySchema.index({ repositoryFullName: 1 }, { unique: true, sparse: true })
repositorySchema.index({ eventId: 1, teamId: 1 })
repositorySchema.index({ eventId: 1, roundId: 1 })

const Repository = mongoose.model('Repository', repositorySchema)

export default Repository
