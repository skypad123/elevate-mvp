import { describe, expect, it } from 'vitest'
import { type ColorScale, type ColorToken, colorScales, portalPalettes } from '../src/index'

/** WCAG 2.x relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`expected #rrggbb, got ${hex}`)
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = Number.parseInt(m[1]!.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

const tokenNames = Object.keys(colorScales.light) as ColorToken[]

/** Every scheme a surface can end up with: Atelier plus each portal layered on top. */
const resolved: Record<string, ColorScale> = {
  'atelier/light': colorScales.light,
  'atelier/dark': colorScales.dark,
}
for (const [id, palette] of Object.entries(portalPalettes)) {
  resolved[`${id}/light`] = { ...colorScales.light, ...palette.light }
  resolved[`${id}/dark`] = { ...colorScales.dark, ...palette.dark }
}

describe('portalPalettes', () => {
  it('only override known colour tokens', () => {
    for (const palette of Object.values(portalPalettes)) {
      for (const scheme of [palette.light, palette.dark]) {
        for (const key of Object.keys(scheme)) expect(tokenNames).toContain(key)
      }
    }
  })

  it('override the same tokens in light and dark so forced themes stay consistent', () => {
    for (const [id, palette] of Object.entries(portalPalettes)) {
      expect(Object.keys(palette.light).sort(), id).toEqual(Object.keys(palette.dark).sort())
    }
  })

  it('light and dark Atelier scales expose the same tokens', () => {
    expect(Object.keys(colorScales.dark).sort()).toEqual([...tokenNames].sort())
  })
})

describe('contrast', () => {
  for (const [name, c] of Object.entries(resolved)) {
    describe(name, () => {
      it('text on a brand fill (brandInk on brand) is AA', () => {
        expect(contrast(c.brandInk, c.brand)).toBeGreaterThanOrEqual(4.5)
      })
      it('brand foreground on surface and canvas is AA', () => {
        expect(contrast(c.brandFg, c.surface)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(c.brandFg, c.canvas)).toBeGreaterThanOrEqual(4.5)
      })
      it('brand foreground on its tint is AA', () => {
        expect(contrast(c.brandFg, c.brandTint)).toBeGreaterThanOrEqual(4.5)
      })
      it('text on an accent fill (accentInk on accent and accentHover) is AA', () => {
        expect(contrast(c.accentInk, c.accent)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(c.accentInk, c.accentHover)).toBeGreaterThanOrEqual(4.5)
      })
      it('accent as text on surface, canvas and its tint is AA', () => {
        expect(contrast(c.accent, c.surface)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(c.accent, c.canvas)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(c.accent, c.accentTint)).toBeGreaterThanOrEqual(4.5)
      })
      it('body ink on canvas and surface is AA', () => {
        expect(contrast(c.ink, c.canvas)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(c.inkSecondary, c.surface)).toBeGreaterThanOrEqual(4.5)
      })
      it('focus ring is visible against the canvas (3:1)', () => {
        expect(contrast(c.focus, c.canvas)).toBeGreaterThanOrEqual(3)
      })
    })
  }
})
