import mongoose from 'mongoose'

const { Schema } = mongoose

const criterionSchema = new Schema(
  {
    rubricId: { type: Schema.Types.ObjectId, ref: 'Rubric', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    maxScore: { type: Number, required: true, min: 0.01 },
    weight: { type: Number, default: 1, min: 0.01 },
    order: { type: Number, default: 1, min: 1 },
    judgeOnly: { type: Boolean, default: false },
    aiSupportForAudit: { type: Boolean, default: true },
    aiInstruction: { type: String }
  },
  { timestamps: true }
)

criterionSchema.index({ rubricId: 1 })
criterionSchema.index({ rubricId: 1, order: 1 })

const Criterion = mongoose.model('Criterion', criterionSchema)

export default Criterion
