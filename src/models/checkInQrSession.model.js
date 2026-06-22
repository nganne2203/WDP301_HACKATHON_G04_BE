import mongoose from 'mongoose'

const { Schema } = mongoose

const checkInQrSessionSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, unique: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
)

checkInQrSessionSchema.index({ expiresAt: 1 })

const CheckInQrSession = mongoose.model('CheckInQrSession', checkInQrSessionSchema)

export default CheckInQrSession
