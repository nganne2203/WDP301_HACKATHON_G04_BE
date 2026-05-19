import mongoose from 'mongoose'

const { Schema } = mongoose

const trackSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String }
  },
  { timestamps: true }
)

trackSchema.index({ eventId: 1, name: 1 }, { unique: true })

const Track = mongoose.model('Track', trackSchema)

export default Track
