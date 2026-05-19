import nodemailer from 'nodemailer'
import { env } from '#configs/environment.js'

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASSWORD
  }
})