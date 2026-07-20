import mongoose from 'mongoose'

const { Schema } = mongoose

const prizeSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    prizeType: {
      type: String,
      enum: ['TEAM', 'INDIVIDUAL'],
      default: 'TEAM'
    },
    rank: { type: Number },
    amount: { type: Number },
    sponsor: { type: String },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    participantId: { type: Schema.Types.ObjectId, ref: 'Participant' }
  },
  { timestamps: true }
)

prizeSchema.index({ competitionId: 1 })

prizeSchema.pre('validate', function validatePrizeTarget(next) {
  if (this.prizeType === 'TEAM' && !this.teamId) {
    this.invalidate('teamId', 'teamId is required for TEAM prize')
  }

  if (this.prizeType === 'INDIVIDUAL' && !this.participantId) {
    this.invalidate('participantId', 'participantId is required for INDIVIDUAL prize')
  }

  next()
})

const Prize = mongoose.model('Prize', prizeSchema)

export default Prize
