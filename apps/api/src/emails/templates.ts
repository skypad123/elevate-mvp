import type { MailMessage } from '../providers/mailer'

const brand = {
  canvas: '#FAF7F1',
  surface: '#FFFFFF',
  ink: '#1A1C1A',
  inkSecondary: '#575B57',
  border: '#E5DED2',
  moss: '#0F6B52',
  ember: '#E8603C',
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:${brand.canvas};font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:${brand.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.canvas};padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${brand.surface};border:1px solid ${brand.border};border-radius:16px;padding:32px">
<tr><td style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:${brand.moss};padding-bottom:16px">Elevate</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:26px;line-height:32px;font-weight:600;padding-bottom:12px">${title}</td></tr>
${bodyHtml}
<tr><td style="font-size:12px;line-height:18px;color:${brand.inkSecondary};padding-top:24px;border-top:1px solid ${brand.border}">If you did not request this email you can ignore it.</td></tr>
</table></td></tr></table></body></html>`
}

const button = (href: string, label: string, colour = brand.moss) =>
  `<a href="${href}" style="display:inline-block;background:${colour};color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 22px;border-radius:10px">${label}</a>`

const para = (text: string) =>
  `<tr><td style="font-size:16px;line-height:24px;color:${brand.inkSecondary};padding-bottom:16px">${text}</td></tr>`

export function magicLinkEmail(input: {
  to: string
  link: string
  code: string
  portalName: string
  expiresMinutes: number
}): MailMessage {
  const prettyCode = `${input.code.slice(0, 3)} ${input.code.slice(3)}`
  const html = layout(
    `Sign in to ${input.portalName}`,
    `${para(`Use the button below to sign in. The link works once and expires in ${input.expiresMinutes} minutes.`)}
<tr><td style="padding-bottom:24px">${button(input.link, 'Sign in')}</td></tr>
${para('On your phone? Enter this code in the app instead:')}
<tr><td style="font-family:ui-monospace,Menlo,monospace;font-size:28px;letter-spacing:6px;font-weight:600;color:${brand.ink};padding-bottom:8px">${prettyCode}</td></tr>`,
  )
  const text = `Sign in to ${input.portalName}\n\nOpen this link (valid for ${input.expiresMinutes} minutes, single use):\n${input.link}\n\nOr enter this code in the app: ${input.code}\n\nIf you did not request this email you can ignore it.`
  return {
    to: input.to,
    subject: `Your ${input.portalName} sign-in code: ${prettyCode}`,
    html,
    text,
  }
}

export function simpleEmail(input: {
  to: string
  title: string
  paragraphs: string[]
  cta?: { href: string; label: string; colour?: string }
}): MailMessage {
  const html = layout(
    input.title,
    `${input.paragraphs.map(para).join('')}${input.cta ? `<tr><td style="padding-top:8px">${button(input.cta.href, input.cta.label, input.cta.colour)}</td></tr>` : ''}`,
  )
  const text = `${input.title}\n\n${input.paragraphs.join('\n\n')}${input.cta ? `\n\n${input.cta.label}: ${input.cta.href}` : ''}`
  return { to: input.to, subject: input.title, html, text }
}
