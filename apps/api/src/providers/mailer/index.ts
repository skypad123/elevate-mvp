import nodemailer, { type Transporter } from 'nodemailer'
import { Resend } from 'resend'
import type { Env } from '../../env'
import type { Logger } from '../../lib/logger'
import type { Mailer, MailMessage } from './types'

export * from './types'

export class ConsoleMailer implements Mailer {
  readonly driver = 'console'
  constructor(private readonly log: Logger) {}
  async send(message: MailMessage): Promise<void> {
    this.log.info(`mail → ${message.to}: ${message.subject}\n${message.text}`)
  }
}

export class SmtpMailer implements Mailer {
  readonly driver = 'smtp'
  private readonly transport: Transporter
  constructor(
    host: string,
    port: number,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport({ host, port, secure: false })
  }
  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message })
  }
}

export class ResendMailer implements Mailer {
  readonly driver = 'resend'
  private readonly resend: Resend
  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.resend = new Resend(apiKey)
  }
  async send(message: MailMessage): Promise<void> {
    const result = await this.resend.emails.send({ from: this.from, ...message })
    if (result.error) throw new Error(`resend: ${result.error.message}`)
  }
}

export function createMailer(env: Env, log: Logger): Mailer {
  switch (env.MAIL_DRIVER) {
    case 'smtp':
      return new SmtpMailer(env.SMTP_HOST, env.SMTP_PORT, env.MAIL_FROM)
    case 'resend':
      if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is required when MAIL_DRIVER=resend')
      return new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM)
    default:
      return new ConsoleMailer(log)
  }
}
