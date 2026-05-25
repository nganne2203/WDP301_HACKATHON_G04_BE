import mongoose from 'mongoose'

const { Schema } = mongoose

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    semester: { type: String },
    seriesName: { type: String, default: 'SEAL Hackathon', trim: true },
    season: {
      type: String,
      enum: ['SPRING', 'SUMMER', 'FALL']
    },
    year: { type: Number },
    theme: { type: String, trim: true },
    registrationStart: { type: Date },
    registrationEnd: { type: Date },
    startDate: { type: Date },
    endDate: { type: Date },
    minTeamMembers: { type: Number, default: 3 },
    maxTeamMembers: { type: Number, default: 5 },
    finalistSlotsPerTrack: { type: Number, default: 5 },
    totalFinalistSlots: { type: Number, default: 10 },
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
eventSchema.index(
  { seriesName: 1, season: 1, year: 1 },
  {
    unique: true,
    partialFilterExpression: {
      season: { $exists: true },
      year: { $exists: true }
    }
  }
)

const Event = mongoose.model('Event', eventSchema)

export default Event
