import mongoose from 'mongoose'

const { Schema } = mongoose

const workshopQuestionSchema = new Schema(
  {
    workshopId: { type: Schema.Types.ObjectId, ref: 'Workshop', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true },
    votes: [
      {
        voterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        votedAt: { type: Date, default: Date.now }
      }
    ],
    voteCount: { type: Number, default: 0 }
  },
  { timestamps: true }
)

workshopQuestionSchema.index({ workshopId: 1, createdAt: 1 })
workshopQuestionSchema.index({ voteCount: 1 })
workshopQuestionSchema.index({ workshopId: 1, voteCount: -1 })

const WorkshopQuestion = mongoose.model('WorkshopQuestion', workshopQuestionSchema)

export default WorkshopQuestion
