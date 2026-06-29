const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const buildText = ({ greeting, heading, message, actionLabel, actionUrl }) => {
  const lines = [
    greeting,
    '',
    heading,
    message
  ]

  if (actionUrl) {
    lines.push('', `${actionLabel}: ${actionUrl}`)
  }

  lines.push('', 'SEAL Hackathon Platform')
  return lines.join('\n')
}

const buildHtml = ({ greeting, heading, message, actionLabel, actionUrl }) => {
  const action = actionUrl
    ? `
      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:600;">
          ${escapeHtml(actionLabel)}
        </a>
      </p>`
    : ''

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
      <p>${escapeHtml(greeting)}</p>
      <h2 style="font-size:20px;margin:16px 0 8px;">${escapeHtml(heading)}</h2>
      <p>${escapeHtml(message)}</p>
      ${action}
      <p style="margin-top:28px;color:#6b7280;font-size:13px;">SEAL Hackathon Platform</p>
    </div>
  `
}

const buildTwoActionHtml = ({
  greeting,
  heading,
  message,
  primaryLabel,
  primaryUrl,
  secondaryLabel,
  secondaryUrl
}) => {
  const primaryAction = primaryUrl
    ? `<a href="${escapeHtml(primaryUrl)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:600;margin-right:8px;">
          ${escapeHtml(primaryLabel)}
        </a>`
    : ''
  const secondaryAction = secondaryUrl
    ? `<a href="${escapeHtml(secondaryUrl)}" style="display:inline-block;background:#f3f4f6;color:#111827;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:600;">
          ${escapeHtml(secondaryLabel)}
        </a>`
    : ''
  const actions = primaryAction || secondaryAction
    ? `<p style="margin:24px 0 0;">${primaryAction}${secondaryAction}</p>`
    : ''

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
      <p>${escapeHtml(greeting)}</p>
      <h2 style="font-size:20px;margin:16px 0 8px;">${escapeHtml(heading)}</h2>
      <p>${escapeHtml(message)}</p>
      ${actions}
      <p style="margin-top:28px;color:#6b7280;font-size:13px;">SEAL Hackathon Platform</p>
    </div>
  `
}

const buildTemplate = ({
  subject,
  fullName,
  heading,
  message,
  actionLabel,
  actionUrl
}) => {
  const safeFullName = fullName || 'there'
  const greeting = `Hi ${safeFullName},`

  return {
    subject,
    text: buildText({ greeting, heading, message, actionLabel, actionUrl }),
    html: buildHtml({ greeting, heading, message, actionLabel, actionUrl })
  }
}

const accountApproved = ({ fullName, loginUrl }) => buildTemplate({
  subject: 'Your SEAL Hackathon account has been approved',
  fullName,
  heading: 'Your account has been approved',
  message: 'You can now sign in and continue with your hackathon registration.',
  actionLabel: 'Sign in',
  actionUrl: loginUrl
})

const accountRejected = ({ fullName }) => buildTemplate({
  subject: 'Your SEAL Hackathon registration status',
  fullName,
  heading: 'Your registration was not approved',
  message: 'Your account registration was reviewed and was not approved at this time. Please contact the organizing team if you have questions.'
})

const eventInvitation = ({ fullName, eventTitle, message, registrationUrl }) => buildTemplate({
  subject: `Invitation to ${eventTitle || 'SEAL Hackathon'}`,
  fullName,
  heading: `You are invited to ${eventTitle || 'SEAL Hackathon'}`,
  message: message || 'The organizing team has invited you to register for this hackathon event.',
  actionLabel: 'Register',
  actionUrl: registrationUrl
})

const notification = ({ fullName, title, message, actionLabel, actionUrl }) => buildTemplate({
  subject: title || 'SEAL Hackathon notification',
  fullName,
  heading: title || 'SEAL Hackathon notification',
  message: message || 'You have a new notification from SEAL Hackathon.',
  actionLabel,
  actionUrl
})

const teamInvitation = ({
  fullName,
  eventTitle,
  teamName,
  leaderName,
  leaderEmail,
  acceptUrl,
  declineUrl
}) => {
  const safeFullName = fullName || 'there'
  const greeting = `Hi ${safeFullName},`
  const heading = `You are invited to join ${teamName || 'a team'}`
  const message = `${leaderName || leaderEmail || 'A team leader'} invited you to join ${teamName || 'their team'} for ${eventTitle || 'SEAL Hackathon'}. Please confirm whether you accept this invitation.`

  return {
    subject: `Team invitation: ${teamName || 'SEAL Hackathon team'}`,
    text: [
      greeting,
      '',
      heading,
      message,
      acceptUrl ? `\nAccept: ${acceptUrl}` : '',
      declineUrl ? `Decline: ${declineUrl}` : '',
      '',
      'SEAL Hackathon Platform'
    ].filter(line => line !== '').join('\n'),
    html: buildTwoActionHtml({
      greeting,
      heading,
      message,
      primaryLabel: 'Accept invitation',
      primaryUrl: acceptUrl,
      secondaryLabel: 'Decline',
      secondaryUrl: declineUrl
    })
  }
}

const temporaryAccount = ({ fullName, email, temporaryPassword, loginUrl }) => buildTemplate({
  subject: 'Your SEAL Hackathon temporary account',
  fullName,
  heading: 'Temporary account created',
  message: `An approved account was created for ${email}. Sign in with the temporary password "${temporaryPassword}" and change your password immediately after login.`,
  actionLabel: 'Sign in',
  actionUrl: loginUrl
})

const passwordReset = ({ fullName, resetUrl, expiresMinutes }) => buildTemplate({
  subject: 'Reset your SEAL Hackathon password',
  fullName,
  heading: 'Reset your password',
  message: `We received a request to reset your password. This link expires in ${expiresMinutes || 30} minutes. If you did not request this, you can ignore this email.`,
  actionLabel: 'Reset password',
  actionUrl: resetUrl
})

const teamConfirmationSuccess = ({ fullName, eventTitle, teamName }) => buildTemplate({
  subject: `You joined ${teamName || 'your SEAL Hackathon team'}`,
  fullName,
  heading: 'Team membership confirmed',
  message: `You are now confirmed as a member of ${teamName || 'your team'} for ${eventTitle || 'SEAL Hackathon'}. Watch the platform for next steps from the organizers.`
})

const teamRejected = ({ fullName, eventTitle, teamName, rejectionReason }) => buildTemplate({
  subject: `Team not confirmed: ${teamName || 'SEAL Hackathon team'}`,
  fullName,
  heading: 'Team registration was rejected',
  message: `${teamName || 'Your team'} for ${eventTitle || 'SEAL Hackathon'} was not confirmed. ${rejectionReason || 'Please contact the organizers for details.'}`
})

const teamMemberDeclined = ({ fullName, eventTitle, teamName, declinedEmail }) => buildTemplate({
  subject: `Team invitation declined: ${teamName || 'SEAL Hackathon team'}`,
  fullName,
  heading: 'A member declined your invitation',
  message: `${declinedEmail} declined the invitation to join ${teamName || 'your team'} for ${eventTitle || 'SEAL Hackathon'}. If registration is still open and slots are available, you can invite a replacement.`
})

export const EMAIL_TEMPLATE_KEYS = {
  ACCOUNT_APPROVED: 'ACCOUNT_APPROVED',
  ACCOUNT_REJECTED: 'ACCOUNT_REJECTED',
  EVENT_INVITATION: 'EVENT_INVITATION',
  TEAM_INVITATION: 'TEAM_INVITATION',
  TEMPORARY_ACCOUNT: 'TEMPORARY_ACCOUNT',
  TEAM_CONFIRMATION_SUCCESS: 'TEAM_CONFIRMATION_SUCCESS',
  TEAM_REJECTED: 'TEAM_REJECTED',
  TEAM_MEMBER_DECLINED: 'TEAM_MEMBER_DECLINED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  NOTIFICATION: 'NOTIFICATION'
}

const TEMPLATES = {
  [EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED]: accountApproved,
  [EMAIL_TEMPLATE_KEYS.ACCOUNT_REJECTED]: accountRejected,
  [EMAIL_TEMPLATE_KEYS.EVENT_INVITATION]: eventInvitation,
  [EMAIL_TEMPLATE_KEYS.TEAM_INVITATION]: teamInvitation,
  [EMAIL_TEMPLATE_KEYS.TEMPORARY_ACCOUNT]: temporaryAccount,
  [EMAIL_TEMPLATE_KEYS.TEAM_CONFIRMATION_SUCCESS]: teamConfirmationSuccess,
  [EMAIL_TEMPLATE_KEYS.TEAM_REJECTED]: teamRejected,
  [EMAIL_TEMPLATE_KEYS.TEAM_MEMBER_DECLINED]: teamMemberDeclined,
  [EMAIL_TEMPLATE_KEYS.PASSWORD_RESET]: passwordReset,
  [EMAIL_TEMPLATE_KEYS.NOTIFICATION]: notification
}

export const renderEmailTemplate = (templateKey, context = {}) => {
  const template = TEMPLATES[templateKey]
  if (!template) {
    throw new Error(`Unknown email template: ${templateKey}`)
  }

  return template(context)
}
