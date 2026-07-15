import mongoose from 'mongoose'

const { Schema } = mongoose

const roundSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
    name: { type: String, required: true, trim: true },
    roundType: {
      type: String,
      enum: ['PRELIMINARY', 'FINAL'],
      default: 'PRELIMINARY'
    },
    problemStatement: { type: String },
    examDriveUrl: { type: String, trim: true },
    assignedTeamIds: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    promotedTeamIds: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    maxPromotedTeams: { type: Number },
    startTime: { type: Date },
    endTime: { type: Date },
    submissionOpenAt: { type: Date },
    submissionCloseAt: { type: Date },
    submissionDeadline: { type: Date },
    publishTime: { type: Date },
    assignedJudgeIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    rubricId: { type: Schema.Types.ObjectId, ref: 'Rubric' },
    promotionRule: { type: String },
    tieBreakRule: { type: String },
    tieBreakDurationMinutes: { type: Number },
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN', 'CLOSED', 'SCORING', 'COMPLETED'],
      default: 'DRAFT'
    }
  },
  { timestamps: true }
)

roundSchema.index({ eventId: 1, trackId: 1 })
roundSchema.index({ roundType: 1 })
roundSchema.index({ assignedTeamIds: 1 })
roundSchema.index({ submissionOpenAt: 1, submissionCloseAt: 1 })
roundSchema.index({ submissionDeadline: 1 })

const Round = mongoose.model('Round', roundSchema)

export default Round
