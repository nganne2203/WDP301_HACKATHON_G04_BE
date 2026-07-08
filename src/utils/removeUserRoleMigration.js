import mongoose from 'mongoose'

import {
  migrateLegacyUserRoleNames,
  normalizeLegacyRoleName,
  PARTICIPANT_ROLE_NAME,
  REMOVED_USER_ROLE_NAME
} from './userRoleMigrationUtil.js'

const getRoleNamesFromValue = (value, roleNameById) => {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.flatMap((item) => getRoleNamesFromValue(item, roleNameById))
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return roleNameById.get(value.toString()) ? [roleNameById.get(value.toString())] : []
  }

  if (typeof value === 'string') {
    if (mongoose.Types.ObjectId.isValid(value)) {
      return roleNameById.get(value) ? [roleNameById.get(value)] : []
    }

    return [normalizeLegacyRoleName(value)]
  }

  if (typeof value === 'object') {
    if (value._id) {
      return getRoleNamesFromValue(value._id, roleNameById)
    }

    if (value.name || value.code) {
      return [normalizeLegacyRoleName(value.name || value.code)]
    }
  }

  return []
}

export const migrateUsersOffRemovedUserRole = async ({ userModel, roleModel, logger = console } = {}) => {
  const roles = await roleModel.find({})
  const roleByName = new Map(roles.map((role) => [String(role.name).trim().toUpperCase(), role]))
  const roleNameById = new Map(roles.map((role) => [role._id.toString(), String(role.name).trim().toUpperCase()]))

  const participantRole = roleByName.get(PARTICIPANT_ROLE_NAME)
  if (!participantRole) {
    throw new Error(`Role "${PARTICIPANT_ROLE_NAME}" must exist before removing "${REMOVED_USER_ROLE_NAME}"`)
  }

  const users = await userModel.collection.find({}, { projection: { _id: 1, role: 1, roles: 1 } }).toArray()
  const operations = []
  let migratedUserCount = 0

  for (const user of users) {
    const currentRoleNames = [
      ...getRoleNamesFromValue(user.role, roleNameById),
      ...getRoleNamesFromValue(user.roles, roleNameById)
    ]
    const normalizedRoleNames = migrateLegacyUserRoleNames(currentRoleNames)
    if (normalizedRoleNames.length === 0) continue

    const nextRoleIds = normalizedRoleNames
      .map((roleName) => roleByName.get(roleName)?._id)
      .filter(Boolean)
    if (nextRoleIds.length !== normalizedRoleNames.length) {
      throw new Error(`Unable to resolve migrated role IDs for user ${user._id}`)
    }

    const currentRoleIds = (Array.isArray(user.roles) ? user.roles : [])
      .map((roleId) => roleId?.toString())
      .filter(Boolean)
    const normalizedRoleIds = nextRoleIds.map((roleId) => roleId.toString())
    const hasSameRoles = currentRoleIds.length === normalizedRoleIds.length &&
      currentRoleIds.every((roleId, index) => roleId === normalizedRoleIds[index])
    const hasLegacyRoleField = Object.prototype.hasOwnProperty.call(user, 'role')

    if (hasSameRoles && !hasLegacyRoleField) {
      continue
    }

    operations.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: { roles: nextRoleIds },
          $unset: { role: '' }
        }
      }
    })
    migratedUserCount += 1
  }

  if (operations.length > 0) {
    await userModel.collection.bulkWrite(operations)
  }

  const removedUserRole = roleByName.get(REMOVED_USER_ROLE_NAME)
  let removedRole = false
  if (removedUserRole) {
    const stillAssignedCount = await userModel.countDocuments({ roles: removedUserRole._id })
    if (stillAssignedCount === 0) {
      await roleModel.deleteOne({ _id: removedUserRole._id })
      removedRole = true
    } else {
      logger.warn?.('Legacy USER role remains because some users are still assigned to it', {
        remainingAssignments: stillAssignedCount
      })
    }
  }

  return {
    scannedUsers: users.length,
    migratedUserCount,
    removedRole
  }
}
