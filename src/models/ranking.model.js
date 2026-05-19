import mongoose from 'mongoose'

const { Schema } = mongoose

const rankingSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    score: { type: Number, required: true },
    rank: { type: Number, required: true },
    publishedAt: { type: Date }
  },
  { timestamps: true }
)

rankingSchema.index({ eventId: 1, roundId: 1, trackId: 1 })
rankingSchema.index({ rank: 1 })

const Ranking = mongoose.model('Ranking', rankingSchema)

export default Ranking
