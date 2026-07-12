import mongoose from 'mongoose'

const { Schema } = mongoose

const rankingSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    rankingType: {
      type: String,
      enum: ['TEAM', 'CHAPTER', 'INDIVIDUAL'],
      default: 'TEAM'
    },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
    trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    participantId: { type: Schema.Types.ObjectId, ref: 'Participant' },
    chapterName: { type: String, trim: true },
    score: { type: Number, required: true },
    pointDelta: { type: Number, default: 0 },
    tieBreakMethod: {
      type: String,
      enum: ['NONE', 'PENALTY_EVALUATION', 'MINI_TEST'],
      default: 'NONE'
    },
    tieBreakScore: { type: Number, default: 0 },
    penaltyScore: { type: Number, default: 0 },
    miniTestScore: { type: Number, default: 0 },
    tieBreakReason: { type: String, trim: true },
    tieBreakResolvedAt: { type: Date },
    tieBreakResolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rankSortScore: { type: Number },
    rank: { type: Number, required: true },
    calculationSource: {
      type: String,
      enum: ['OFFICIAL_JUDGE_SCORES_ONLY'],
      default: 'OFFICIAL_JUDGE_SCORES_ONLY'
    },
    calculationSummary: { type: Schema.Types.Mixed },
    calculatedAt: { type: Date },
    isSelectedForFinal: { type: Boolean, default: false },
    selectionReason: { type: String },
    note: { type: String },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
)

rankingSchema.index({ eventId: 1, rankingType: 1, roundId: 1, trackId: 1 })
rankingSchema.index({ eventId: 1, rankingType: 1, teamId: 1 })
rankingSchema.index({ eventId: 1, rankingType: 1, participantId: 1 })
rankingSchema.index({ eventId: 1, rankingType: 1, chapterName: 1 })
rankingSchema.index({ eventId: 1, rankingType: 1, roundId: 1, trackId: 1, rank: 1 })
rankingSchema.index({ eventId: 1, roundId: 1, isSelectedForFinal: 1 })
rankingSchema.index({ rank: 1 })

rankingSchema.pre('validate', function validateRankingTarget(next) {
  if (this.rankingType === 'TEAM' && !this.teamId) {
    this.invalidate('teamId', 'teamId is required for TEAM ranking')
  }

  if (this.rankingType === 'CHAPTER' && !this.chapterName) {
    this.invalidate('chapterName', 'chapterName is required for CHAPTER ranking')
  }

  if (this.rankingType === 'INDIVIDUAL' && !this.participantId) {
    this.invalidate('participantId', 'participantId is required for INDIVIDUAL ranking')
  }

  next()
})

const Ranking = mongoose.model('Ranking', rankingSchema)

export default Ranking
