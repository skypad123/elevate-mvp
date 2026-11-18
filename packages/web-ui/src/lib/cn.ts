import { typeScale } from '@elevate/tokens'
import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge knows only Tailwind's own font sizes, so on its own it reads a type-scale utility
 * such as `text-body` as a colour: `text-brand-ink text-body` lost the colour and
 * `text-caption text-ink-secondary` lost the size. These are the scale's names as
 * `@elevate/tokens/theme.css` declares them (`--text-body-lg` → `text-body-lg`).
 */
const fontSizes = Object.keys(typeScale).map((key) =>
  key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
)

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: fontSizes }] } },
})

/** Merge Tailwind class lists, letting later utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
