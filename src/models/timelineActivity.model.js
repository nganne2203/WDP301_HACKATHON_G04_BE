import mongoose from 'mongoose'

const { Schema } = mongoose

const timelineActivitySchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    startTime: { type: Date },
    endTime: { type: Date },
    activityType: {
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

timelineActivitySchema.index({ competitionId: 1, startTime: 1 })
timelineActivitySchema.index({ activityType: 1 })

const TimelineActivity = mongoose.model('TimelineActivity', timelineActivitySchema)

export default TimelineActivity
