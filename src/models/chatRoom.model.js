import mongoose from 'mongoose'

const { Schema } = mongoose

const chatRoomSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, unique: true },
    roomKey: { type: String, required: true, trim: true, unique: true }
  },
  { timestamps: true }
)

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema)

export default ChatRoom
