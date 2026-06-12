import mongoose from 'mongoose'

const { Schema } = mongoose

const changedCodeContextSchema = new Schema(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    commitSha: { type: String, required: true, trim: true },
    filePath: { type: String, required: true, trim: true },
    symbolName: { type: String, required: true, trim: true },
    symbolType: {
      type: String,
      enum: ['FUNCTION', 'CLASS', 'ROUTE', 'SERVICE_METHOD', 'CONTROLLER_METHOD', 'MODULE_SYMBOL'],
      required: true
    },
    startLine: { type: Number },
    endLine: { type: Number },
    contextSnippet: { type: String },
    confidence: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM'
    }
  },
  { timestamps: true }
)

changedCodeContextSchema.index({ repositoryId: 1, commitSha: 1, filePath: 1 })

const ChangedCodeContext = mongoose.model('ChangedCodeContext', changedCodeContextSchema)

export default ChangedCodeContext
