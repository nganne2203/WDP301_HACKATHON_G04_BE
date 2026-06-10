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
    cleanDiffText: { type: String },
    cleanDiffSummary: {
      maxIncludedFilesBudget: { type: Number, default: 0 },
      totalFiles: { type: Number, default: 0 },
      includedFiles: { type: Number, default: 0 },
      excludedFiles: { type: Number, default: 0 },
      totalRawPatchSize: { type: Number, default: 0 },
      totalCleanPatchSize: { type: Number, default: 0 },
      truncatedFileCount: { type: Number, default: 0 },
      includedFilePaths: [{ type: String }],
      excludedFileSummaries: [{
        filePath: { type: String },
        reason: { type: String }
      }]
    },
    totalRawPatchSize: { type: Number, default: 0 },
    totalCleanPatchSize: { type: Number, default: 0 },
    totalFiles: { type: Number, default: 0 },
    includedFiles: { type: Number, default: 0 },
    excludedFiles: { type: Number, default: 0 },
    files: [{
      filePath: { type: String },
      previousFilePath: { type: String },
      fileName: { type: String },
      language: { type: String },
      status: { type: String },
      additions: { type: Number },
      deletions: { type: Number },
      changes: { type: Number },
      patch: { type: String },
      cleanPatch: { type: String },
      patchSummary: { type: String },
      excludedReason: { type: String },
      isBinary: { type: Boolean, default: false },
      isGenerated: { type: Boolean, default: false },
      isMinified: { type: Boolean, default: false },
      isBuildArtifact: { type: Boolean, default: false },
      isLockFile: { type: Boolean, default: false },
      isExcluded: { type: Boolean, default: false },
      isTruncated: { type: Boolean, default: false },
      rawPatchSize: { type: Number, default: 0 },
      cleanPatchSize: { type: Number, default: 0 },
      hunkCount: { type: Number, default: 0 },
      addedLineCount: { type: Number, default: 0 },
      removedLineCount: { type: Number, default: 0 }
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
