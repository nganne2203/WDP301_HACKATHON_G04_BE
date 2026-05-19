import mongoose from 'mongoose'

const { Schema } = mongoose

const workshopFeedbackSchema = new Schema(
  {
    workshopId: { type: Schema.Types.ObjectId, ref: 'Workshop', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String }
  },
  { timestamps: true }
)

workshopFeedbackSchema.index({ workshopId: 1, authorId: 1 }, { unique: true })

const WorkshopFeedback = mongoose.model('WorkshopFeedback', workshopFeedbackSchema)

export default WorkshopFeedback
