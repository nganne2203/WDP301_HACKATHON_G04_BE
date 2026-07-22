import mongoose from 'mongoose'

const { Schema } = mongoose

const normalizeTeamName = (name) => {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

const teamSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
    leaderId: { type: Schema.Types.ObjectId, ref: 'User' },
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    mentorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, trim: true, lowercase: true },
    chapterName: { type: String, trim: true },
    projectName: { type: String, trim: true },
    trackAssignmentMethod: {
      type: String,
      enum: ['DRAW', 'MANUAL', 'SYSTEM'],
      default: 'MANUAL'
    },
    boardNumber: { type: Number, min: 1 },
    placementSlot: { type: Number, min: 1 },
    waitlistPosition: { type: Number, min: 1 },
    trackAssignedAt: { type: Date },
    qualificationStatus: {
      type: String,
      enum: ['REGISTERED', 'PRELIMINARY', 'FINALIST', 'AWARDED', 'ELIMINATED'],
      default: 'REGISTERED'
    },
    status: {
      type: String,
      enum: ['WAITING_FOR_MEMBERS', 'WAITLISTED', 'CONFIRMED', 'REJECTED', 'CANCELLED'],
      default: 'WAITING_FOR_MEMBERS'
    },
    confirmedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true }
  },
  { timestamps: true }
)

teamSchema.pre('validate', function setNormalizedName(next) {
  this.normalizedName = normalizeTeamName(this.name)
  next()
})

teamSchema.index({ competitionId: 1, trackId: 1 })
teamSchema.index(
  { competitionId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['WAITING_FOR_MEMBERS', 'WAITLISTED', 'CONFIRMED'] } }
  }
)
teamSchema.index(
  { competitionId: 1, normalizedName: 1 },
  {
    unique: true,
    partialFilterExpression: {
      normalizedName: { $type: 'string' },
      status: { $in: ['WAITING_FOR_MEMBERS', 'WAITLISTED', 'CONFIRMED'] }
    }
  }
)
teamSchema.index(
  { competitionId: 1, leaderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      leaderId: { $exists: true },
      status: { $in: ['WAITING_FOR_MEMBERS', 'WAITLISTED', 'CONFIRMED'] }
    }
  }
)
teamSchema.index({ competitionId: 1, status: 1 })
teamSchema.index({ competitionId: 1, chapterName: 1 })
teamSchema.index({ competitionId: 1, mentorIds: 1 })
teamSchema.index({ qualificationStatus: 1 })

const Team = mongoose.model('Team', teamSchema)

export default Team
