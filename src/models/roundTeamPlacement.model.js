import mongoose from 'mongoose'

const { Schema } = mongoose

const roundTeamPlacementSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    boardId: { type: Schema.Types.ObjectId, ref: 'JudgingBoard' },
    boardNumber: { type: Number, required: true, min: 1 },
    placementSlot: { type: Number, required: true, min: 1 }
  },
  { timestamps: true }
)

roundTeamPlacementSchema.index({ roundId: 1, teamId: 1 }, { unique: true })
roundTeamPlacementSchema.index({ competitionId: 1, roundId: 1, boardNumber: 1 })
roundTeamPlacementSchema.index({ boardId: 1 })

const RoundTeamPlacement = mongoose.model('RoundTeamPlacement', roundTeamPlacementSchema)

export default RoundTeamPlacement
