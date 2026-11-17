import { translate } from '@elevate/i18n'
import { describe, expect, it } from 'vitest'
import { escapeHtml, magicLinkEmail, simpleEmail } from '../src/emails/templates'

const signIn = (locale: 'en' | 'zh') =>
  magicLinkEmail({
    to: 'learner@example.com',
    link: 'http://learner.test/verify?token=abc&lang=zh',
    code: '123456',
    portalName: 'Elevate',
    expiresMinutes: 15,
    locale,
  })

// The Chinese text comes from the catalog, so these hold while it is still being written (the
// catalog test reports it missing) and check the real Chinese once it is there.
describe('learner email templates', () => {
  it.each(['en', 'zh'] as const)('builds the sign-in code email in %s', (locale) => {
    const mail = signIn(locale)
    expect(mail.subject).toBe(
      translate(locale, 'email.signIn.subject', { portal: 'Elevate', code: '123 456' }),
    )
    expect(mail.html).toContain(`<html lang="${locale}">`)
    expect(mail.html).toContain('<meta charset="utf-8">')
    for (const sentence of [
      translate(locale, 'email.signIn.title', { portal: 'Elevate' }),
      translate(locale, 'email.signIn.body', { minutes: 15 }),
      translate(locale, 'email.signIn.button'),
      translate(locale, 'email.signIn.codeIntro'),
      translate(locale, 'email.footer.ignore'),
    ])
      expect(mail.html).toContain(escapeHtml(sentence))
    expect(mail.text).toContain(translate(locale, 'email.signIn.text.code', { code: '123456' }))
    expect(mail.text).toContain(translate(locale, 'email.footer.ignore'))
    expect(mail.text).toContain('http://learner.test/verify?token=abc&lang=zh')
  })

  it('keeps the English sign-in email as it was', () => {
    const mail = signIn('en')
    expect(mail.subject).toBe('Your Elevate sign-in code: 123 456')
    expect(mail.text).toBe(
      'Sign in to Elevate\n\nOpen this link (valid for 15 minutes, single use):\nhttp://learner.test/verify?token=abc&lang=zh\n\nOr enter this code in the app: 123456\n\nIf you did not request this email you can ignore it.',
    )
  })

  it('writes the language and the footer of a simple email, English by default', () => {
    const zh = simpleEmail({ to: 'a@example.com', title: 'T', paragraphs: ['P'], locale: 'zh' })
    expect(zh.html).toContain('<html lang="zh">')
    expect(zh.html).toContain(escapeHtml(translate('zh', 'email.footer.ignore')))
    const en = simpleEmail({ to: 'a@example.com', title: 'T', paragraphs: ['P'] })
    expect(en.html).toContain('<html lang="en">')
    expect(en.html).toContain('If you did not request this email you can ignore it.')
  })

  it.each(['en', 'zh'] as const)("writes the button's line of the text part in %s", (locale) => {
    const mail = simpleEmail({
      to: 'a@example.com',
      locale,
      title: 'T',
      paragraphs: ['P'],
      cta: { href: 'http://learner.test/learn/1', label: 'Go' },
    })
    expect(
      mail.text.endsWith(
        translate(locale, 'email.text.cta', { label: 'Go', url: 'http://learner.test/learn/1' }),
      ),
    ).toBe(true)
    if (locale === 'en') expect(mail.text.endsWith('Go: http://learner.test/learn/1')).toBe(true)
  })

  it.each(['en', 'zh'] as const)('escapes a course title typed by a teacher, in %s', (locale) => {
    const course = '<script>alert(1)</script>'
    const mail = simpleEmail({
      to: 'a@example.com',
      locale,
      title: translate(locale, 'email.receipt.title', { course }),
      paragraphs: [
        translate(locale, 'email.certificate.congrats', { name: 'A', course, teacher: 'T' }),
      ],
    })
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })
})
