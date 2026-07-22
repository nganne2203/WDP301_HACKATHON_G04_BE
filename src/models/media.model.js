import mongoose from 'mongoose'

const { Schema } = mongoose

const mediaSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    mediaType: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'DOCUMENT'],
      required: true
    },
    storageProvider: {
      type: String,
      default: 'SUPABASE'
    },
    bucketName: { type: String, required: true, trim: true },
    storagePath: { type: String, required: true, trim: true },
    fileUrl: { type: String, trim: true },
    originalFileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    fileSize: { type: Number, required: true },
    fileExtension: { type: String, required: true, trim: true, lowercase: true },
    tags: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectReason: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
)

mediaSchema.index({ competitionId: 1 })
mediaSchema.index({ uploadedBy: 1 })
mediaSchema.index({ teamId: 1 })
mediaSchema.index({ mediaType: 1 })
mediaSchema.index({ status: 1 })
mediaSchema.index({ uploadedAt: 1 })
mediaSchema.index({ competitionId: 1, uploadedAt: -1 })
mediaSchema.index({ uploadedBy: 1, uploadedAt: -1 })
mediaSchema.index({ tags: 1 })

const Media = mongoose.model('Media', mediaSchema)

export default Media
