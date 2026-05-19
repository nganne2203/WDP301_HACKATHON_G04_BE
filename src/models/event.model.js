import mongoose from 'mongoose'

const { Schema } = mongoose

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    semester: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN_REGISTRATION', 'ONGOING', 'SCORING', 'COMPLETED', 'ARCHIVED'],
      default: 'DRAFT'
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
)

eventSchema.index({ status: 1 })
eventSchema.index({ startDate: 1 })

const Event = mongoose.model('Event', eventSchema)

export default Event
