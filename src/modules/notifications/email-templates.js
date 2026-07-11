const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const buildText = ({ greeting, heading, message, actionLabel, actionUrl, bodyLines = [], footerNote }) => {
  const lines = [
    greeting,
    '',
    heading,
    message
  ]

  if (bodyLines.length > 0) {
    lines.push('', ...bodyLines)
  }

  if (actionUrl) {
    lines.push('', `${actionLabel}: ${actionUrl}`)
  }

  lines.push('', footerNote || 'SEAL Hackathon Platform')
  return lines.join('\n')
}

const brandShell = ({
  eyebrow = 'SEAL Hackathon Platform',
  greeting,
  heading,
  message,
  body = '',
  action = '',
  footerNote = 'SEAL Hackathon Platform'
}) => `
  <div style="margin:0;padding:32px 16px;background:#f4f7fb;">
    <div style="max-width:640px;margin:0 auto;font-family:Arial,sans-serif;color:#111827;">
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);border-radius:20px 20px 0 0;padding:24px 28px;color:#ffffff;">
        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.78;font-weight:700;">${escapeHtml(eyebrow)}</div>
        <div style="margin-top:14px;font-size:14px;opacity:0.9;">${escapeHtml(greeting)}</div>
        <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;">${escapeHtml(heading)}</h1>
      </div>
      <div style="background:#ffffff;border:1px solid #dbe4f0;border-top:none;border-radius:0 0 20px 20px;padding:28px;box-shadow:0 20px 45px rgba(15,23,42,0.08);">
        <p style="margin:0;font-size:15px;line-height:1.75;color:#334155;">${escapeHtml(message)}</p>
        ${body}
        ${action}
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;color:#64748b;">
          ${escapeHtml(footerNote)}
        </div>
      </div>
    </div>
  </div>
`

const buildInfoRows = (rows = []) => {
  if (!rows.length) return ''

  const items = rows.map(({ label, value, emphasize = false }) => `
    <tr>
      <td style="padding:12px 0;color:#64748b;font-size:13px;vertical-align:top;width:140px;">${escapeHtml(label)}</td>
      <td style="padding:12px 0;color:#0f172a;font-size:14px;font-weight:${emphasize ? '700' : '600'};word-break:break-word;">${escapeHtml(value)}</td>
    </tr>
  `).join('')

  return `
    <div style="margin-top:22px;padding:18px 20px;border:1px solid #dbe4f0;border-radius:16px;background:#f8fbff;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        ${items}
      </table>
    </div>
  `
}

const buildActionButton = ({ label, url, tone = 'primary' }) => {
  if (!url) return ''

  const palette = tone === 'secondary'
    ? {
      background: '#e2e8f0',
      color: '#0f172a'
    }
    : {
      background: '#2563eb',
      color: '#ffffff'
    }

  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:${palette.background};color:${palette.color};text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:700;font-size:14px;">${escapeHtml(label)}</a>`
}

const buildHtml = ({ greeting, heading, message, actionLabel, actionUrl, body, footerNote }) => {
  const action = actionUrl
    ? `
      <div style="margin-top:24px;">
        ${buildActionButton({ label: actionLabel, url: actionUrl })}
      </div>`
    : ''

  return brandShell({
    greeting,
    heading,
    message,
    body,
    action,
    footerNote
  })
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
    ? buildActionButton({ label: primaryLabel, url: primaryUrl })
    : ''
  const secondaryAction = secondaryUrl
    ? buildActionButton({ label: secondaryLabel, url: secondaryUrl, tone: 'secondary' })
    : ''
  const actions = primaryAction || secondaryAction
    ? `<div style="margin-top:24px;">${primaryAction}${secondaryAction ? ` <span style="display:inline-block;width:8px;"></span>${secondaryAction}` : ''}</div>`
    : ''

  return brandShell({
    greeting,
    heading,
    message,
    action: actions
  })
}

const buildTemplate = ({
  subject,
  fullName,
  heading,
  message,
  actionLabel,
  actionUrl,
  body,
  footerNote,
  bodyLines
}) => {
  const safeFullName = fullName || 'there'
  const greeting = `Hi ${safeFullName},`

  return {
    subject,
    text: buildText({ greeting, heading, message, actionLabel, actionUrl, bodyLines, footerNote }),
    html: buildHtml({ greeting, heading, message, actionLabel, actionUrl, body, footerNote })
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
  heading: 'Your account is ready',
  message: 'An approved account has been prepared for you. Use the credentials below to sign in, then change your password right away on the first login.',
  actionLabel: 'Open sign in',
  actionUrl: loginUrl,
  bodyLines: [
    `Email: ${email}`,
    `Temporary password: ${temporaryPassword}`,
    'For security, this password is temporary. Please change it immediately after you enter the platform.'
  ],
  body: `
    ${buildInfoRows([
      { label: 'Email', value: email },
      { label: 'Temporary password', value: temporaryPassword, emphasize: true }
    ])}
    <div style="margin-top:18px;padding:16px 18px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;line-height:1.7;">
      For security, this password is temporary. Please change it immediately after you enter the platform.
    </div>
  `,
  footerNote: 'If you did not expect this account, please contact the organizing team.'
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
