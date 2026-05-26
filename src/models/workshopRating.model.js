import mongoose from 'mongoose'

const { Schema } = mongoose

const workshopRatingSchema = new Schema(
  {
    workshopId: { type: Schema.Types.ObjectId, ref: 'Workshop', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 }
  },
  { timestamps: true }
)

workshopRatingSchema.index({ workshopId: 1, authorId: 1 }, { unique: true })
workshopRatingSchema.index({ workshopId: 1, rating: 1 })

const WorkshopRating = mongoose.model('WorkshopRating', workshopRatingSchema)

export default WorkshopRating
