export const REGISTRATION_SOURCES = {
  FORM: 'FORM',
  GOOGLE: 'GOOGLE'
}

export const ACCESSIBLE_USER_STATUSES = ['ACTIVE']

export const getRegistrationSource = (user = {}) => {
  if (Object.values(REGISTRATION_SOURCES).includes(user.registrationSource)) {
    return user.registrationSource
  }

  // Older Google sign-in code changed authProvider to GOOGLE even for an
  // existing form account. A password hash is therefore the safer legacy
  // signal that the account originated from the registration form.
  return user.authProvider === 'GOOGLE' && !user.passwordHash
    ? REGISTRATION_SOURCES.GOOGLE
    : REGISTRATION_SOURCES.FORM
}

export const isGoogleAccount = (user = {}) => {
  return getRegistrationSource(user) === REGISTRATION_SOURCES.GOOGLE
}

export const canAccessAuthenticatedRoutes = (user = {}) => {
  return ACCESSIBLE_USER_STATUSES.includes(user.status)
}
