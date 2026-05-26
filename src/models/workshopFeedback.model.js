import mongoose from 'mongoose'

const { Schema } = mongoose

const workshopFeedbackSchema = new Schema(
  {
    workshopId: { type: Schema.Types.ObjectId, ref: 'Workshop', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, required: true, trim: true }
  },
  { timestamps: true }
)

workshopFeedbackSchema.index({ workshopId: 1, authorId: 1 }, { unique: true })
workshopFeedbackSchema.index({ workshopId: 1, createdAt: -1 })

const WorkshopFeedback = mongoose.model('WorkshopFeedback', workshopFeedbackSchema)

export default WorkshopFeedback
