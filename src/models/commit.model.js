import mongoose from 'mongoose'

const { Schema } = mongoose

const commitSchema = new Schema(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    commitSha: { type: String, required: true },
    branch: { type: String, trim: true },
    provider: { type: String, default: 'GITHUB' },
    repositoryFullName: { type: String, trim: true },
    parentCommitShas: [{ type: String, trim: true }],
    authorName: { type: String },
    authorEmail: { type: String },
    authorUsername: { type: String, trim: true },
    timestamp: { type: Date },
    message: { type: String },
    commitUrl: { type: String, trim: true },
    linesAdded: { type: Number },
    linesRemoved: { type: Number },
    filesChanged: { type: Number },
    rawStats: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
)

commitSchema.index({ repositoryId: 1, timestamp: 1 })
commitSchema.index({ commitSha: 1 }, { unique: true })

const Commit = mongoose.model('Commit', commitSchema)

export default Commit
