import mongoose from 'mongoose'

const { Schema } = mongoose

const chatMessageSchema = new Schema(
  {
    chatRoomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['member', 'mentor'], required: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    clientMessageId: { type: String, trim: true },
    isSeen: { type: Boolean, default: false }
  },
  { timestamps: true }
)

chatMessageSchema.index({ chatRoomId: 1, createdAt: -1 })
chatMessageSchema.index({ teamId: 1, createdAt: -1 })
chatMessageSchema.index(
  { chatRoomId: 1, senderId: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } }
)

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema)

export default ChatMessage
