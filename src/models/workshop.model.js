import mongoose from 'mongoose'

const { Schema } = mongoose

const workshopSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
    timelineEventId: { type: Schema.Types.ObjectId, ref: 'TimelineEvent' },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    presenterId: { type: Schema.Types.ObjectId, ref: 'User' },
    meetLink: { type: String },
    startTime: { type: Date },
    endTime: { type: Date },
    status: {
      type: String,
      enum: ['SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED'
    }
  },
  { timestamps: true }
)

workshopSchema.index({ eventId: 1, startTime: 1 })
workshopSchema.index({ presenterId: 1 })

const Workshop = mongoose.model('Workshop', workshopSchema)

export default Workshop
