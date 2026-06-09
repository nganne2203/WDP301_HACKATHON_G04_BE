import mongoose from 'mongoose'

const { Schema } = mongoose

const staticAnalysisResultSchema = new Schema(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    commitSha: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ['SECRET_SCAN', 'DEPENDENCY_SCAN', 'COMMAND_HOOK_ESLINT', 'COMMAND_HOOK_TSC'],
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'SKIPPED', 'FAILED'],
      default: 'COMPLETED'
    },
    errorCount: { type: Number, default: 0 },
    warningCount: { type: Number, default: 0 },
    findings: [{
      type: { type: String, trim: true },
      severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      filePath: { type: String, trim: true },
      title: { type: String, trim: true },
      message: { type: String, trim: true },
      evidence: [{ type: String, trim: true }]
    }],
    rawOutput: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
)

staticAnalysisResultSchema.index({ repositoryId: 1, commitSha: 1, source: 1 }, { unique: true })
staticAnalysisResultSchema.index({ repositoryId: 1, commitSha: 1 })

const StaticAnalysisResult = mongoose.model('StaticAnalysisResult', staticAnalysisResultSchema)

export default StaticAnalysisResult
