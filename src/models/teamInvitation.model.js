import mongoose from 'mongoose'

const { Schema } = mongoose

const teamInvitationSchema = new Schema(
  {
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    leaderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invitedEmail: { type: String, required: true, lowercase: true, trim: true },
    invitedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'],
      default: 'PENDING'
    },
    acceptedAt: { type: Date },
    declinedAt: { type: Date },
    cancelledAt: { type: Date },
    replacedByInvitationId: { type: Schema.Types.ObjectId, ref: 'TeamInvitation' },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
)

teamInvitationSchema.index({ competitionId: 1, invitedEmail: 1, status: 1 })
teamInvitationSchema.index({ competitionId: 1, invitedUserId: 1, status: 1 })
teamInvitationSchema.index({ teamId: 1, status: 1 })
teamInvitationSchema.index({ expiresAt: 1 })

const TeamInvitation = mongoose.model('TeamInvitation', teamInvitationSchema)

export default TeamInvitation
