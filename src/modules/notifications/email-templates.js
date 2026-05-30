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

export const EMAIL_TEMPLATE_KEYS = {
  ACCOUNT_APPROVED: 'ACCOUNT_APPROVED',
  ACCOUNT_REJECTED: 'ACCOUNT_REJECTED',
  EVENT_INVITATION: 'EVENT_INVITATION',
  NOTIFICATION: 'NOTIFICATION'
}

const TEMPLATES = {
  [EMAIL_TEMPLATE_KEYS.ACCOUNT_APPROVED]: accountApproved,
  [EMAIL_TEMPLATE_KEYS.ACCOUNT_REJECTED]: accountRejected,
  [EMAIL_TEMPLATE_KEYS.EVENT_INVITATION]: eventInvitation,
  [EMAIL_TEMPLATE_KEYS.NOTIFICATION]: notification
}

export const renderEmailTemplate = (templateKey, context = {}) => {
  const template = TEMPLATES[templateKey]
  if (!template) {
    throw new Error(`Unknown email template: ${templateKey}`)
  }

  return template(context)
}
