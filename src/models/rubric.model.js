import mongoose from 'mongoose'

const { Schema } = mongoose

const rubricSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    totalScore: { type: Number },
    version: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
      default: 'DRAFT'
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
)

rubricSchema.index({ eventId: 1 })
rubricSchema.index({ eventId: 1, roundId: 1, status: 1 })

const Rubric = mongoose.model('Rubric', rubricSchema)

export default Rubric
