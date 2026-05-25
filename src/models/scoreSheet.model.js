import mongoose from 'mongoose'

const { Schema } = mongoose

const scoreSheetSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
    boardId: { type: Schema.Types.ObjectId, ref: 'JudgingBoard' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true },
    judgeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rubricId: { type: Schema.Types.ObjectId, ref: 'Rubric' },
    scoreIds: [{ type: Schema.Types.ObjectId, ref: 'Score' }],
    totalScore: { type: Number, default: 0 },
    weightedScore: { type: Number, default: 0 },
    finalScore: { type: Number, default: 0 },
    generalComment: { type: String },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'LOCKED'],
      default: 'DRAFT'
    },
    submittedAt: { type: Date },
    lockedAt: { type: Date }
  },
  { timestamps: true }
)

scoreSheetSchema.index({ roundId: 1, teamId: 1, judgeId: 1 }, { unique: true })
scoreSheetSchema.index({ submissionId: 1, judgeId: 1 })
scoreSheetSchema.index({ eventId: 1, roundId: 1 })
scoreSheetSchema.index({ status: 1 })

const ScoreSheet = mongoose.model('ScoreSheet', scoreSheetSchema)

export default ScoreSheet
