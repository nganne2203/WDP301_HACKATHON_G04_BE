import mongoose from 'mongoose'

const { Schema } = mongoose

const criterionSchema = new Schema(
  {
    rubricId: { type: Schema.Types.ObjectId, ref: 'Rubric', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    maxScore: { type: Number, required: true },
    weight: { type: Number, default: 1 }
  },
  { timestamps: true }
)

criterionSchema.index({ rubricId: 1 })

const Criterion = mongoose.model('Criterion', criterionSchema)

export default Criterion
