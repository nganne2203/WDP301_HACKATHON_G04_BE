import mongoose from 'mongoose'

const { Schema } = mongoose

const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date }
  },
  { timestamps: true }
)

passwordResetTokenSchema.index({ userId: 1, createdAt: -1 })
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema)

export default PasswordResetToken
