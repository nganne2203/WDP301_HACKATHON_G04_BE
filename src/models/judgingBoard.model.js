import mongoose from 'mongoose'

const { Schema } = mongoose

const judgingBoardSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
    name: { type: String, required: true, trim: true },
    boardNumber: { type: Number, required: true },
    teamIds: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    judgeIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    maxTeams: { type: Number, default: 10 },
    status: {
      type: String,
      enum: ['DRAFT', 'ASSIGNED', 'SCORING', 'COMPLETED'],
      default: 'DRAFT'
    }
  },
  { timestamps: true }
)

judgingBoardSchema.index({ eventId: 1, roundId: 1, boardNumber: 1 }, { unique: true })
judgingBoardSchema.index({ eventId: 1, trackId: 1 })
judgingBoardSchema.index({ judgeIds: 1 })
judgingBoardSchema.index({ teamIds: 1 })

const JudgingBoard = mongoose.model('JudgingBoard', judgingBoardSchema)

export default JudgingBoard
