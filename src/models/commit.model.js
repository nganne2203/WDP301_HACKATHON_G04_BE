import mongoose from 'mongoose'

const { Schema } = mongoose

const commitSchema = new Schema(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    commitSha: { type: String, required: true },
    authorName: { type: String },
    authorEmail: { type: String },
    timestamp: { type: Date },
    message: { type: String },
    linesAdded: { type: Number },
    linesRemoved: { type: Number },
    filesChanged: { type: Number }
  },
  { timestamps: true }
)

commitSchema.index({ repositoryId: 1, timestamp: 1 })
commitSchema.index({ commitSha: 1 }, { unique: true })

const Commit = mongoose.model('Commit', commitSchema)

export default Commit
