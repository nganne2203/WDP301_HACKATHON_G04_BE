import mongoose from 'mongoose'

const { Schema } = mongoose

const rubricSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    totalScore: { type: Number, enum: [4, 10, 100], default: 100 },
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

rubricSchema.index({ competitionId: 1 })
rubricSchema.index({ competitionId: 1, roundId: 1, status: 1 })

const Rubric = mongoose.model('Rubric', rubricSchema)

export default Rubric
