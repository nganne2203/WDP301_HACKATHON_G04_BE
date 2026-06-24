import nodemailer from 'nodemailer'
import { env } from '#configs/environment.js'

const parseProviderError = async (response) => {
  const payload = await response.json().catch(() => null)
  return payload?.message || payload?.error || `HTTP ${response.status}`
}

export const createResendTransport = ({
  apiKey,
  apiUrl = 'https://api.resend.com',
  fetchImpl = fetch
}) => {
  return {
    sendMail: async ({ from, to, subject, html, text }) => {
      const recipients = Array.isArray(to) ? to : [to]
      const response = await fetchImpl(`${apiUrl.replace(/\/$/, '')}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from, to: recipients, subject, html, text }),
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        throw new Error(`Resend email failed: ${await parseProviderError(response)}`)
      }

      const result = await response.json()
      return {
        accepted: recipients,
        rejected: [],
        messageId: result.id
      }
    }
  }
}

const createTransportOptions = () => {
  if (env.email.service && env.email.user && env.email.password) {
    return {
      service: env.email.service,
      auth: {
        user: env.email.user,
        pass: env.email.password
      }
    }
  }

  if (env.email.host) {
    const options = {
      host: env.email.host,
      port: env.email.port || 587,
      secure: env.email.secure
    }

    if (env.email.user && env.email.password) {
      options.auth = {
        user: env.email.user,
        pass: env.email.password
      }
    }

    return options
  }

  if (env.email.user && env.email.password) {
    return {
      service: 'gmail',
      auth: {
        user: env.email.user,
        pass: env.email.password
      }
    }
  }

  return null
}

const useResend = env.email.provider === 'resend' || Boolean(env.email.resendApiKey)
const transportOptions = useResend ? null : createTransportOptions()

export const transporter = useResend
  ? (env.email.resendApiKey
    ? createResendTransport({
      apiKey: env.email.resendApiKey,
      apiUrl: env.email.resendApiUrl
    })
    : null)
  : (transportOptions ? nodemailer.createTransport(transportOptions) : null)

export const MAIL_CONFIG = {
  enabled: Boolean(transporter),
  from: env.email.from || env.email.user,
  devMode: env.email.devMode,
  transport: useResend
    ? {
      provider: 'resend',
      apiUrl: env.email.resendApiUrl
    }
    : transportOptions
      ? {
        provider: 'smtp',
        service: transportOptions.service,
        host: transportOptions.host,
        port: transportOptions.port,
        secure: transportOptions.secure
      }
      : null
}
