import mongoose from 'mongoose'

const { Schema } = mongoose

const repositorySchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    githubOrg: { type: String },
    repoName: { type: String },
    repoUrl: { type: String, required: true },
    contributors: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    defaultBranch: { type: String },
    submissionStatus: {
      type: String,
      enum: ['NOT_SUBMITTED', 'SUBMITTED', 'APPROVED'],
      default: 'NOT_SUBMITTED'
    },
    lastSyncAt: { type: Date }
  },
  { timestamps: true }
)

repositorySchema.index({ teamId: 1 }, { unique: true })
repositorySchema.index({ repoUrl: 1 }, { unique: true })

const Repository = mongoose.model('Repository', repositorySchema)

export default Repository
