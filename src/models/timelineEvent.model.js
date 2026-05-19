import mongoose from 'mongoose'

const { Schema } = mongoose

const timelineEventSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    startTime: { type: Date },
    endTime: { type: Date },
    eventType: {
      type: String,
      enum: ['WORKSHOP', 'CHECK_IN', 'ROUND', 'RESULT_PUBLISHING', 'CEREMONY', 'OTHER'],
      default: 'OTHER'
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED'
    }
  },
  { timestamps: true }
)

timelineEventSchema.index({ eventId: 1, startTime: 1 })
timelineEventSchema.index({ eventType: 1 })

const TimelineEvent = mongoose.model('TimelineEvent', timelineEventSchema)

export default TimelineEvent
