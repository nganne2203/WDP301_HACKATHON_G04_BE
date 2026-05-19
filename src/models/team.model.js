import mongoose from 'mongoose'

const { Schema } = mongoose

const teamSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'DISQUALIFIED'],
      default: 'ACTIVE'
    }
  },
  { timestamps: true }
)

teamSchema.index({ eventId: 1, trackId: 1 })
teamSchema.index({ name: 1 })

const Team = mongoose.model('Team', teamSchema)

export default Team
