export const PARTICIPANT_ROLE_NAME = 'PARTICIPANT'
export const REMOVED_USER_ROLE_NAME = 'USER'

const LEGACY_ROLE_NAME_ALIASES = {
  TEAM_LEADER: PARTICIPANT_ROLE_NAME
}

export const normalizeLegacyRoleName = (roleName) => {
  const normalizedRoleName = String(roleName || '').trim().toUpperCase()
  return LEGACY_ROLE_NAME_ALIASES[normalizedRoleName] || normalizedRoleName
}

export const migrateLegacyUserRoleNames = (roleNames = []) => {
  const normalizedRoleNames = [...new Set(roleNames.map(normalizeLegacyRoleName).filter(Boolean))]

  if (!normalizedRoleNames.includes(REMOVED_USER_ROLE_NAME)) {
    return normalizedRoleNames
  }

  const nextRoleNames = normalizedRoleNames.filter((roleName) => roleName !== REMOVED_USER_ROLE_NAME)
  if (nextRoleNames.length === 0) {
    return [PARTICIPANT_ROLE_NAME]
  }

  return nextRoleNames
}

export const requiresParticipantProfile = (roleNames = []) => {
  return roleNames.map(normalizeLegacyRoleName).includes(PARTICIPANT_ROLE_NAME)
}
