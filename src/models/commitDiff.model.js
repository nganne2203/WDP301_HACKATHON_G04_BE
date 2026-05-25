import mongoose from 'mongoose'

const { Schema } = mongoose

const commitDiffSchema = new Schema(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    commitId: { type: Schema.Types.ObjectId, ref: 'Commit' },
    baseCommitSha: { type: String, trim: true },
    headCommitSha: { type: String, required: true, trim: true },
    provider: { type: String, default: 'GITHUB' },
    status: {
      type: String,
      enum: ['PENDING', 'READY', 'FAILED'],
      default: 'PENDING'
    },
    diffHash: { type: String, trim: true },
    diffText: { type: String },
    files: [{
      filePath: { type: String },
      status: { type: String },
      additions: { type: Number },
      deletions: { type: Number },
      patch: { type: String }
    }],
    fetchedAt: { type: Date },
    lastError: { type: String },
    expiresAt: { type: Date }
  },
  { timestamps: true }
)

commitDiffSchema.index({ repositoryId: 1, headCommitSha: 1 }, { unique: true })
commitDiffSchema.index({ commitId: 1 })
commitDiffSchema.index({ status: 1 })
commitDiffSchema.index({ expiresAt: 1 })

const CommitDiff = mongoose.model('CommitDiff', commitDiffSchema)

export default CommitDiff
