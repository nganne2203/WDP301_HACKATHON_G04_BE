import mongoose from 'mongoose'

const { Schema } = mongoose

const teamSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
    name: { type: String, required: true, trim: true },
    chapterName: { type: String, trim: true },
    projectName: { type: String, trim: true },
    trackAssignmentMethod: {
      type: String,
      enum: ['DRAW', 'MANUAL', 'SYSTEM'],
      default: 'MANUAL'
    },
    trackAssignedAt: { type: Date },
    qualificationStatus: {
      type: String,
      enum: ['REGISTERED', 'PRELIMINARY', 'FINALIST', 'AWARDED', 'ELIMINATED'],
      default: 'REGISTERED'
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'DISQUALIFIED'],
      default: 'ACTIVE'
    }
  },
  { timestamps: true }
)

teamSchema.index({ eventId: 1, trackId: 1 })
teamSchema.index({ eventId: 1, name: 1 }, { unique: true })
teamSchema.index({ eventId: 1, chapterName: 1 })
teamSchema.index({ qualificationStatus: 1 })

const Team = mongoose.model('Team', teamSchema)

export default Team
