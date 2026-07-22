import mongoose from 'mongoose'

const { Schema } = mongoose

const mediaActivitySchema = new Schema(
  {
    mediaId: { type: Schema.Types.ObjectId, ref: 'Media', required: true },
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['UPLOAD', 'VIEW', 'DOWNLOAD', 'APPROVE', 'REJECT', 'DELETE'],
      required: true
    },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
)

mediaActivitySchema.index({ mediaId: 1, createdAt: -1 })
mediaActivitySchema.index({ competitionId: 1, createdAt: -1 })
mediaActivitySchema.index({ userId: 1, createdAt: -1 })
mediaActivitySchema.index({ action: 1, createdAt: -1 })

const MediaActivity = mongoose.model('MediaActivity', mediaActivitySchema)

export default MediaActivity
