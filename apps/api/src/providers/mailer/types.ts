export type MailMessage = { to: string; subject: string; html: string; text: string }

export interface Mailer {
  readonly driver: string
  send(message: MailMessage): Promise<void>
}

/** Collects messages in memory for tests. */
export class FakeMailer implements Mailer {
  readonly driver = 'fake'
  readonly sent: MailMessage[] = []
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message)
  }
  last(): MailMessage | undefined {
    return this.sent.at(-1)
  }
}
