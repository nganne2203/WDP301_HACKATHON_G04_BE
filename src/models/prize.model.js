import mongoose from 'mongoose'

const { Schema } = mongoose

const prizeSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    amount: { type: Number },
    sponsor: { type: String },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' }
  },
  { timestamps: true }
)

prizeSchema.index({ eventId: 1 })

const Prize = mongoose.model('Prize', prizeSchema)

export default Prize
