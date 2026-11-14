// @pdf-lib/fontkit's bundle expects the Babel regenerator global when subsetting large fonts.
import 'regenerator-runtime/runtime.js'
import { readdir, readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, type PDFFont, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import { apiRoot } from '../env'

export type CertificateInput = {
  learnerName: string
  courseTitle: string
  teacherName: string
  issuedAt: Date
  verifyUrl: string
  token: string
}

export type CertificateRenderOptions = {
  /**
   * Font files (.ttf/.otf) tried in order when the bundled Fraunces/Inter lack glyphs for a name
   * or title, e.g. Noto Sans SC for Chinese or Noto Sans Tamil. Only embedded when needed, subset.
   */
  fallbackFonts?: string[]
}

const fallbackDir = resolve(apiRoot, 'assets/fonts/fallback')

/** Fallback fonts: `CERTIFICATE_FALLBACK_FONTS` (comma-separated paths) plus assets/fonts/fallback/. */
export async function listFallbackFonts(fromEnv: string | undefined): Promise<string[]> {
  const configured = (fromEnv ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  let bundled: string[] = []
  try {
    bundled = (await readdir(fallbackDir))
      .filter((f) => ['.ttf', '.otf'].includes(extname(f).toLowerCase()))
      .sort()
      .map((f) => resolve(fallbackDir, f))
  } catch {
    bundled = []
  }
  return [...configured, ...bundled]
}

const COLORS = {
  canvas: rgb(0.98, 0.968, 0.945),
  ink: rgb(0.102, 0.11, 0.102),
  inkSecondary: rgb(0.34, 0.357, 0.34),
  moss: rgb(0.059, 0.42, 0.322),
  border: rgb(0.898, 0.871, 0.824),
}

const fontsDir = resolve(apiRoot, 'assets/fonts')

async function embed(doc: PDFDocument, file: string, fallback: StandardFonts): Promise<PDFFont> {
  try {
    const bytes = await readFile(resolve(fontsDir, file))
    return await doc.embedFont(bytes, { subset: true })
  } catch {
    return doc.embedFont(fallback)
  }
}

const charSets = new WeakMap<PDFFont, Set<number>>()

function supportedChars(font: PDFFont): Set<number> | null {
  const cached = charSets.get(font)
  if (cached) return cached
  try {
    const set = new Set(font.getCharacterSet())
    charSets.set(font, set)
    return set
  } catch {
    return null
  }
}

function canRender(text: string, font: PDFFont): boolean {
  const set = supportedChars(font)
  if (!set) return true
  return [...text].every((ch) => /\s/.test(ch) || set.has(ch.codePointAt(0) ?? -1))
}

/** Lazily embeds fallback fonts, in order, the first time a glyph is missing. */
class FontChain {
  private embedded: PDFFont[] = []
  private next = 0
  constructor(
    private readonly doc: PDFDocument,
    private readonly paths: string[],
  ) {}

  async pick(text: string, primary: PDFFont): Promise<{ font: PDFFont; text: string }> {
    if (canRender(text, primary)) return { font: primary, text }
    for (const font of this.embedded) if (canRender(text, font)) return { font, text }
    while (this.next < this.paths.length) {
      const path = this.paths[this.next++] as string
      try {
        const font = await this.doc.embedFont(await readFile(path), { subset: true })
        this.embedded.push(font)
        if (canRender(text, font)) return { font, text }
      } catch {
        // unreadable font file: skip it
      }
    }
    // No font covers every glyph: drop what the primary font cannot draw rather than print boxes.
    const set = supportedChars(primary)
    const kept = set
      ? [...text].filter((ch) => /\s/.test(ch) || set.has(ch.codePointAt(0) ?? -1)).join('')
      : text
    return { font: primary, text: kept.replace(/\s+/g, ' ').trim() }
  }
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) current = candidate
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/** A4 landscape certificate in the Atelier style; returns PDF bytes. */
export async function renderCertificatePdf(
  input: CertificateInput,
  options: CertificateRenderOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(`Certificate of completion — ${input.courseTitle}`)
  doc.setAuthor('Elevate')
  doc.setSubject(input.learnerName)
  const page = doc.addPage([841.89, 595.28])
  const { width, height } = page.getSize()
  const display = await embed(doc, 'Fraunces-SemiBold.ttf', StandardFonts.TimesRomanBold)
  const text = await embed(doc, 'Inter-Regular.ttf', StandardFonts.Helvetica)
  const textBold = await embed(doc, 'Inter-SemiBold.ttf', StandardFonts.HelveticaBold)
  const chain = new FontChain(doc, options.fallbackFonts ?? [])

  page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.canvas })
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: COLORS.moss,
    borderWidth: 2,
  })
  page.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: height - 72,
    borderColor: COLORS.border,
    borderWidth: 1,
  })

  // wordmark
  page.drawRectangle({ x: 64, y: height - 92, width: 22, height: 22, color: COLORS.moss })
  page.drawText('Elevate', { x: 94, y: height - 88, size: 20, font: display, color: COLORS.ink })

  const centre = (t: string, font: PDFFont, size: number, y: number, color = COLORS.ink) => {
    const w = font.widthOfTextAtSize(t, size)
    page.drawText(t, { x: (width - w) / 2, y, size, font, color })
  }

  centre('CERTIFICATE OF COMPLETION', textBold, 11, height - 150, COLORS.moss)
  centre('This certifies that', text, 13, height - 190, COLORS.inkSecondary)

  const name = await chain.pick(input.learnerName, display)
  const nameText = name.text || `Learner ${input.token.slice(0, 6)}`
  const nameSize = name.font.widthOfTextAtSize(nameText, 42) > width - 160 ? 32 : 42
  centre(nameText, name.font, nameSize, height - 240)
  page.drawLine({
    start: { x: width / 2 - 120, y: height - 256 },
    end: { x: width / 2 + 120, y: height - 256 },
    thickness: 1,
    color: COLORS.border,
  })

  centre('has completed', text, 13, height - 290, COLORS.inkSecondary)
  const title = await chain.pick(input.courseTitle, display)
  const titleLines = wrap(title.text, title.font, 24, width - 200)
  titleLines.slice(0, 2).forEach((line, i) => {
    centre(line, title.font, 24, height - 326 - i * 30)
  })
  const afterTitle = height - 326 - (Math.min(titleLines.length, 2) - 1) * 30
  const teacher = await chain.pick(input.teacherName, text)
  centre(
    `taught by ${teacher.text} on Elevate`,
    teacher.font,
    13,
    afterTitle - 36,
    COLORS.inkSecondary,
  )
  const dateLabel = input.issuedAt.toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  centre(dateLabel, textBold, 12, afterTitle - 60)

  // verification block
  const qr = await QRCode.toBuffer(input.verifyUrl, {
    margin: 0,
    width: 240,
    color: { dark: '#1A1C1A', light: '#FAF7F1' },
  })
  const qrImage = await doc.embedPng(qr)
  page.drawImage(qrImage, { x: width - 64 - 84, y: 62, width: 84, height: 84 })
  page.drawText('Verify this certificate', {
    x: 64,
    y: 118,
    size: 10,
    font: textBold,
    color: COLORS.ink,
  })
  page.drawText(input.verifyUrl, { x: 64, y: 102, size: 10, font: text, color: COLORS.moss })
  page.drawText(`Certificate ID ${input.token}`, {
    x: 64,
    y: 86,
    size: 9,
    font: text,
    color: COLORS.inkSecondary,
  })
  page.drawText(
    'Elevate verifies completion of self-directed online courses. Single tier, no scheme claim attached.',
    {
      x: 64,
      y: 66,
      size: 8,
      font: text,
      color: COLORS.inkSecondary,
    },
  )

  return doc.save()
}
