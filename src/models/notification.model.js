import mongoose from 'mongoose'

const { Schema } = mongoose

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String },
    type: { type: String, enum: ['DEADLINE', 'WORKSHOP', 'RESULT', 'FEEDBACK', 'SYSTEM'], default: 'SYSTEM' },
    status: { type: String, enum: ['UNREAD', 'READ'], default: 'UNREAD' },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
)

notificationSchema.index({ userId: 1, status: 1 })
notificationSchema.index({ createdAt: 1 })

const Notification = mongoose.model('Notification', notificationSchema)

export default Notification
