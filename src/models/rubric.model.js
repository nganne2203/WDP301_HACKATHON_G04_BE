import mongoose from 'mongoose'

const { Schema } = mongoose

const rubricSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    totalScore: { type: Number },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
)

rubricSchema.index({ eventId: 1 })

const Rubric = mongoose.model('Rubric', rubricSchema)

export default Rubric
