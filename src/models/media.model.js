import mongoose from 'mongoose'

const { Schema } = mongoose

const mediaSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    url: { type: String, required: true },
    caption: { type: String },
    tags: [{ type: String }]
  },
  { timestamps: true }
)

mediaSchema.index({ eventId: 1, createdAt: 1 })
mediaSchema.index({ tags: 1 })

const Media = mongoose.model('Media', mediaSchema)

export default Media
