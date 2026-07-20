import mongoose from 'mongoose'

const { Schema } = mongoose

const workshopSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    timelineActivityId: { type: Schema.Types.ObjectId, ref: 'TimelineActivity' },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    presenterId: { type: Schema.Types.ObjectId, ref: 'User' },
    speakerInfo: {
      name: { type: String, trim: true },
      title: { type: String, trim: true },
      bio: { type: String },
      email: { type: String, trim: true, lowercase: true }
    },
    meetLink: { type: String },
    googleMeet: {
      enabled: { type: Boolean, default: false },
      meetLink: { type: String },
      calendarCompetitionId: { type: String },
      htmlLink: { type: String },
      organizerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      organizerEmail: { type: String, trim: true, lowercase: true },
      createdAt: { type: Date }
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    questionnaire: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ['SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED'
    }
  },
  { timestamps: true }
)

workshopSchema.index({ competitionId: 1, startTime: 1 })
workshopSchema.index({ presenterId: 1 })
workshopSchema.index({ 'googleMeet.calendarCompetitionId': 1 })
workshopSchema.index({ status: 1 })

const Workshop = mongoose.model('Workshop', workshopSchema)

export default Workshop
