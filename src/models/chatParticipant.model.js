import mongoose from 'mongoose'

const { Schema } = mongoose

const chatParticipantSchema = new Schema(
  {
    chatRoomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['member', 'mentor'], required: true },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date }
  },
  { timestamps: true }
)

chatParticipantSchema.index({ chatRoomId: 1, userId: 1 }, { unique: true })
chatParticipantSchema.index({ userId: 1 })

const ChatParticipant = mongoose.model('ChatParticipant', chatParticipantSchema)

export default ChatParticipant
