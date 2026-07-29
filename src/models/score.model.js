import mongoose from 'mongoose'

const { Schema } = mongoose

const scoreSchema = new Schema(
  {
    // Scores can belong to a team that did not submit a deliverable. The
    // score-sheet remains the canonical owner in both cases.
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', default: null },
    scoreSheetId: { type: Schema.Types.ObjectId, ref: 'ScoreSheet' },
    judgeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    criterionId: { type: Schema.Types.ObjectId, ref: 'Criterion' },
    scoreValue: { type: Number, required: true, min: 0 },
    isOverridden: { type: Boolean, default: false },
    overrideReason: { type: String },
    comment: { type: String }
  },
  { timestamps: true }
)

scoreSchema.index({ scoreSheetId: 1, criterionId: 1 }, { unique: true })
scoreSchema.index({ scoreSheetId: 1 })
scoreSchema.index({ judgeId: 1 })

const Score = mongoose.model('Score', scoreSchema)

export default Score
