import assert from 'node:assert/strict'
import test from 'node:test'

import ApiError from '../src/utils/ApiError.js'
import { CHAT_SERVICE } from '../src/modules/chat/chat.service.js'

const ids = {
  actor: '000000000000000000000101',
  mentor: '000000000000000000000102',
  team: '000000000000000000000201',
  completedTeam: '000000000000000000000202',
  archivedTeam: '000000000000000000000203',
  room: '000000000000000000000301'
}

const makeTeam = ({ _id = ids.team, competitionStatus = 'ONGOING' } = {}) => ({
  _id,
  competitionId: { _id: '000000000000000000000401', status: competitionStatus },
  leaderId: ids.actor,
  memberIds: [],
  mentorIds: [ids.mentor],
  name: `Team ${_id.slice(-1)}`,
  projectName: 'Project',
  status: 'CONFIRMED'
})

test('completed competition team chat is read-only while archived competition chat is hidden', async () => {
  let upsertCount = 0
  const completedTeam = makeTeam({ _id: ids.completedTeam, competitionStatus: 'COMPLETED' })
  const archivedTeam = makeTeam({ _id: ids.archivedTeam, competitionStatus: 'ARCHIVED' })
  const room = {
    _id: ids.room,
    teamId: completedTeam,
    roomKey: `team_${ids.completedTeam}`,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const repository = {
    async findTeamsForUser() {
      return [completedTeam, archivedTeam]
    },
    async findTeamById() {
      return completedTeam
    },
    async findRoomById() {
      return room
    },
    async ensureRoomForTeam(teamId) {
      return { ...room, teamId: teamId === ids.archivedTeam ? archivedTeam : completedTeam }
    },
    async upsertParticipant(payload) {
      upsertCount += 1
      return { ...payload, role: 'member', lastReadAt: null }
    },
    async findLastMessage() {
      return null
    },
    async countUnreadMessages() {
      return 0
    },
    async findMessageByClientId() {
      return null
    },
    async createMessage() {
      throw new Error('completed chat should be read-only')
    }
  }

  const rooms = await CHAT_SERVICE.listRooms({
    actor: { id: ids.actor },
    repository
  })
  assert.equal(rooms.length, 1)
  assert.equal(rooms[0].teamId, ids.completedTeam)
  assert.equal(rooms[0].team.competitionStatus, 'COMPLETED')

  const beforeSendUpserts = upsertCount
  await assert.rejects(
    CHAT_SERVICE.createMessage({
      teamId: ids.completedTeam,
      message: 'Hello after final result',
      actor: { id: ids.actor },
      repository
    }),
    error => error instanceof ApiError &&
      error.code === 'BAD_REQUEST' &&
      error.errors.includes('Chat room is read-only after competition completion')
  )
  assert.equal(upsertCount, beforeSendUpserts)
})
