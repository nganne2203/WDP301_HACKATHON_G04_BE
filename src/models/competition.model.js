import mongoose from 'mongoose'

const { Schema } = mongoose

const competitionConfigSchema = new Schema(
  {
    boardCount: { type: Number, min: 1 },
    trackCount: { type: Number, min: 1 },
    maxTeamsPerBoard: { type: Number, min: 1 },
    finalistCount: { type: Number, min: 1 },
    finalistsPerBoard: { type: Number, min: 1 },
    finalistSelectionMode: {
      type: String,
      enum: ['FIXED_PER_BOARD', 'TOP_PER_BOARD_WITH_WILDCARD', 'OVERALL_SCORE', 'CUSTOM']
    },
    rankingScopes: [{
      type: String,
      enum: ['TEAM', 'CHAPTER', 'INDIVIDUAL']
    }],
    tieBreakRule: { type: String, trim: true },
    tieBreakDurationMinutes: { type: Number, min: 1 }
  },
  { _id: false }
)

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    semester: { type: String },
    seriesName: { type: String, default: 'SEAL Hackathon', trim: true },
    season: {
      type: String,
      enum: ['SPRING', 'SUMMER', 'FALL']
    },
    year: { type: Number },
    theme: { type: String, trim: true },
    registrationStart: { type: Date },
    registrationEnd: { type: Date },
    registrationClosedAt: { type: Date },
    registrationCloseReason: {
      type: String,
      enum: ['CAPACITY_REACHED', 'REGISTRATION_ENDED', 'MANUALLY_CLOSED'],
      trim: true
    },
    startDate: { type: Date },
    endDate: { type: Date },
    maxTeams: { type: Number, default: 30 },
    minTeamMembers: { type: Number, default: 3 },
    maxTeamMembers: { type: Number, default: 5 },
    competitionConfig: {
      type: competitionConfigSchema,
      default: () => ({ rankingScopes: ['TEAM'] })
    },
    finalistSlotsPerTrack: { type: Number, default: 5 },
    totalFinalistSlots: { type: Number, default: 10 },
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN_REGISTRATION', 'REGISTRATION_CLOSED', 'ONGOING', 'SCORING', 'COMPLETED', 'ARCHIVED'],
      default: 'DRAFT'
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
)

eventSchema.index({ status: 1 })
eventSchema.index({ startDate: 1 })
eventSchema.index(
  { seriesName: 1, season: 1, year: 1 },
  {
    unique: true,
    partialFilterExpression: {
      season: { $exists: true },
      year: { $exists: true }
    }
  }
)

const Competition = mongoose.model('Competition', eventSchema)

export default Competition
