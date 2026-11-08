import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listFallbackFonts, renderCertificatePdf } from '../src/lib/certificate-pdf'

const base = {
  courseTitle: 'Sourdough from Scratch',
  teacherName: 'Daniel Goh',
  issuedAt: new Date('2026-11-08T04:00:00Z'),
  verifyUrl: 'http://learner.test/c/0123456789ABCDEFGHJK',
  token: '0123456789ABCDEFGHJK',
}
const isPdf = (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'

// A CJK + Tamil capable font that happens to ship with macOS; CI has none, so that case is skipped.
const unicodeFont = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'

describe('certificate PDF', () => {
  it('renders an A4 landscape certificate with the bundled fonts', async () => {
    const bytes = await renderCertificatePdf({ ...base, learnerName: 'Grace Lim' })
    expect(isPdf(bytes)).toBe(true)
    expect(bytes.length).toBeGreaterThan(5_000)
    expect(bytes.length).toBeLessThan(400_000)
  })

  it('never fails on names the bundled fonts cannot draw', async () => {
    for (const learnerName of ['陈美玲', 'கவிதா ராஜன்', 'Nguyễn Thị Hoa', 'Zoë Ødegård']) {
      const bytes = await renderCertificatePdf(
        { ...base, learnerName, courseTitle: '手绘蜡染：上蜡、染色、收尾' },
        { fallbackFonts: ['/definitely/missing.ttf'] },
      )
      expect(isPdf(bytes)).toBe(true)
    }
  })

  it.skipIf(!existsSync(unicodeFont))(
    'embeds a configured fallback font for Chinese and Tamil names',
    async () => {
      const bytes = await renderCertificatePdf(
        { ...base, learnerName: 'கவிதா ராஜன் · 陈美玲' },
        { fallbackFonts: [unicodeFont] },
      )
      expect(isPdf(bytes)).toBe(true)
      // subset embedding keeps a 22 MB font down to the handful of glyphs used
      expect(bytes.length).toBeLessThan(600_000)
    },
  )

  it('collects fallback fonts from the env var and the bundled folder', async () => {
    const list = await listFallbackFonts(' /a/one.ttf, /b/two.otf ,,')
    expect(list.slice(0, 2)).toEqual(['/a/one.ttf', '/b/two.otf'])
    expect(await listFallbackFonts(undefined)).toEqual([])
  })
})
