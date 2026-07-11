import dns from 'node:dns'
import mongoose from 'mongoose'

import { env } from '#configs/environment.js'
import ChatMessage from '#models/chatMessage.model.js'
import ChatParticipant from '#models/chatParticipant.model.js'
import ChatRoom from '#models/chatRoom.model.js'
import Team from '#models/team.model.js'

dns.setServers(['8.8.8.8', '1.1.1.1'])

async function main() {
  if (!env.db.uri) {
    throw new Error('MONGODB_URI is required')
  }

  await mongoose.connect(env.db.uri)

  const cancelledTeamIds = await Team.find({ status: 'CANCELLED' }).distinct('_id')
  if (cancelledTeamIds.length === 0) {
    console.log('No cancelled teams found.')
    return
  }

  const rooms = await ChatRoom.find({ teamId: { $in: cancelledTeamIds } }).select('_id teamId roomKey')
  if (rooms.length === 0) {
    console.log(`No chat rooms found for ${cancelledTeamIds.length} cancelled team(s).`)
    return
  }

  const roomIds = rooms.map(room => room._id)
  const [messages, participants, deletedRooms] = await Promise.all([
    ChatMessage.deleteMany({ chatRoomId: { $in: roomIds } }),
    ChatParticipant.deleteMany({ chatRoomId: { $in: roomIds } }),
    ChatRoom.deleteMany({ _id: { $in: roomIds } })
  ])

  console.log(`Cancelled teams checked: ${cancelledTeamIds.length}`)
  console.log(`Chat rooms deleted: ${deletedRooms.deletedCount || 0}`)
  console.log(`Chat messages deleted: ${messages.deletedCount || 0}`)
  console.log(`Chat participants deleted: ${participants.deletedCount || 0}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
