import mongoose from 'mongoose'

const { Schema } = mongoose

const trackSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    code: { type: String, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    topic: { type: String, trim: true },
    problemStatement: { type: String },
    type: {
      type: String,
      enum: ['PRELIMINARY_GROUP', 'FINAL_POOL', 'GENERAL'],
      default: 'PRELIMINARY_GROUP'
    },
    teamIds: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    maxTeams: { type: Number },
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN', 'LOCKED', 'COMPLETED'],
      default: 'DRAFT'
    }
  },
  { timestamps: true }
)

trackSchema.index({ eventId: 1, name: 1 }, { unique: true })
trackSchema.index({ eventId: 1, code: 1 }, { unique: true, sparse: true })
trackSchema.index({ teamIds: 1 })

const Track = mongoose.model('Track', trackSchema)

export default Track
