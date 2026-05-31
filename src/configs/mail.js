import nodemailer from 'nodemailer'
import { env } from '#configs/environment.js'

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

const transportOptions = createTransportOptions()

export const transporter = transportOptions
  ? nodemailer.createTransport(transportOptions)
  : null

export const MAIL_CONFIG = {
  enabled: Boolean(transporter),
  from: env.email.from || env.email.user,
  devMode: env.email.devMode,
  transport: transportOptions
    ? {
      service: transportOptions.service,
      host: transportOptions.host,
      port: transportOptions.port,
      secure: transportOptions.secure
    }
    : null
}
