import mongoose from 'mongoose'

const { Schema } = mongoose

const participantSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    chapterName: { type: String, trim: true },
    teamRole: {
      type: String,
      enum: ['MEMBER', 'LEADER'],
      default: 'MEMBER'
    },
    isGraduated: { type: Boolean, default: false },
    consentMediaUse: { type: Boolean, default: false },
    eligibilityStatus: {
      type: String,
      enum: ['PENDING', 'ELIGIBLE', 'INELIGIBLE'],
      default: 'PENDING'
    },
    attendedActivities: [{
      type: String,
      enum: ['WORKSHOP', 'OPENING', 'TEAM_MEETING', 'CODING', 'PRESENTATION', 'CLOSING']
    }],
    checkInStatus: {
      type: String,
      enum: ['NOT_CHECKED_IN', 'CHECKED_IN'],
      default: 'NOT_CHECKED_IN'
    },
    githubAccessStatus: {
      type: String,
      enum: ['NOT_GRANTED', 'GRANTED', 'REVOKED'],
      default: 'NOT_GRANTED'
    },
    status: {
      type: String,
      enum: ['INVITED', 'ACTIVE', 'WITHDRAWN'],
      default: 'INVITED'
    },
    joinedAt: { type: Date }
  },
  { timestamps: true }
)

participantSchema.index({ eventId: 1, userId: 1 }, { unique: true })
participantSchema.index({ eventId: 1, teamId: 1 })
participantSchema.index({ eventId: 1, chapterName: 1 })
participantSchema.index({ checkInStatus: 1 })
participantSchema.index({ githubAccessStatus: 1 })
participantSchema.index(
  { teamId: 1, teamRole: 1 },
  { unique: true, partialFilterExpression: { teamRole: 'LEADER', teamId: { $exists: true } } }
)

const Participant = mongoose.model('Participant', participantSchema)

export default Participant
