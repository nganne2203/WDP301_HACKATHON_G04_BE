const PRIVILEGED_EVENT_ROLES = new Set(['ADMIN', 'EVENT_COORDINATOR', 'COORDINATOR'])

export const getActorId = (actor = {}) => {
  return actor?.id?.toString?.() || actor?._id?.toString?.() || null
}

export const getActorRoles = (actor = {}) => {
  return (Array.isArray(actor.roles) ? actor.roles : [actor.role])
    .map(role => role?.code || role?.name || role)
    .filter(Boolean)
    .map(role => String(role).trim().toUpperCase())
}

export const actorHasRole = (actor = {}, roleName) => {
  const normalizedRole = String(roleName || '').trim().toUpperCase()
  return getActorRoles(actor).includes(normalizedRole)
}

export const getSubjectRoles = (subject = {}) => {
  return (Array.isArray(subject.roles) ? subject.roles : [subject.role])
    .map(role => role?.code || role?.name || role)
    .filter(Boolean)
    .map(role => String(role).trim().toUpperCase())
}

export const isActiveJudge = (user = {}) => {
  if (!user || user.status !== 'ACTIVE') return false
  return getSubjectRoles(user).includes('JUDGE')
}

export const isPrivilegedEventActor = (actor = {}) => {
  return getActorRoles(actor).some(role => PRIVILEGED_EVENT_ROLES.has(role))
}

export const isParticipantOnlyActor = (actor = {}) => {
  const roles = getActorRoles(actor)
  return roles.length > 0 && roles.every(role => role === 'PARTICIPANT' || role === 'USER')
}

export const getIdString = (value) => {
  return value?._id?.toString?.() || value?.id?.toString?.() || value?.toString?.() || null
}

export const idsEqual = (left, right) => {
  const leftId = getIdString(left)
  const rightId = getIdString(right)
  return Boolean(leftId && rightId && leftId === rightId)
}

export const idListIncludes = (values = [], id) => {
  const targetId = getIdString(id)
  if (!targetId) return false
  return (values || []).some(value => getIdString(value) === targetId)
}
