import mongoose from 'mongoose'

const { Schema } = mongoose

const scoreSchema = new Schema(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true },
    judgeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    criterionId: { type: Schema.Types.ObjectId, ref: 'Criterion' },
    scoreValue: { type: Number, required: true },
    comment: { type: String }
  },
  { timestamps: true }
)

scoreSchema.index({ submissionId: 1, judgeId: 1, criterionId: 1 }, { unique: true })
scoreSchema.index({ judgeId: 1 })

const Score = mongoose.model('Score', scoreSchema)

export default Score
