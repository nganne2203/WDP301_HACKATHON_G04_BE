import mongoose from 'mongoose'

const { Schema } = mongoose

const roundSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
    name: { type: String, required: true, trim: true },
    submissionDeadline: { type: Date },
    publishTime: { type: Date },
    assignedJudgeIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    rubricId: { type: Schema.Types.ObjectId, ref: 'Rubric' },
    promotionRule: { type: String },
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN', 'CLOSED', 'SCORING', 'COMPLETED'],
      default: 'DRAFT'
    }
  },
  { timestamps: true }
)

roundSchema.index({ eventId: 1, trackId: 1 })
roundSchema.index({ submissionDeadline: 1 })

const Round = mongoose.model('Round', roundSchema)

export default Round
