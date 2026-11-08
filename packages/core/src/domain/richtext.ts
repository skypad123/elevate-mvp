import { z } from 'zod'

/**
 * The subset of Tiptap/ProseMirror JSON that Elevate stores and renders.
 * Validated on save so the React Native renderer never meets an unknown node.
 */

const markSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('strike') }),
  z.object({ type: z.literal('code') }),
  z.object({
    type: z.literal('link'),
    attrs: z.object({
      href: z.string().url().or(z.string().startsWith('mailto:')),
      target: z.string().nullable().optional(),
      rel: z.string().nullable().optional(),
      class: z.string().nullable().optional(),
    }),
  }),
])

export const textNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  marks: z.array(markSchema).optional(),
})

export const hardBreakSchema = z.object({ type: z.literal('hardBreak') })

const inlineNodeSchema = z.union([textNodeSchema, hardBreakSchema])

export const imageNodeSchema = z.object({
  type: z.literal('image'),
  attrs: z.object({
    src: z.string().min(1),
    alt: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
  }),
})

export const paragraphSchema = z.object({
  type: z.literal('paragraph'),
  attrs: z.object({ textAlign: z.string().nullable().optional() }).optional(),
  content: z.array(inlineNodeSchema).optional(),
})

export const headingSchema = z.object({
  type: z.literal('heading'),
  attrs: z.object({ level: z.number().int().min(1).max(3) }),
  content: z.array(inlineNodeSchema).optional(),
})

export const codeBlockSchema = z.object({
  type: z.literal('codeBlock'),
  attrs: z.object({ language: z.string().nullable().optional() }).optional(),
  content: z.array(textNodeSchema).optional(),
})

export type RichTextBlock =
  | z.infer<typeof paragraphSchema>
  | z.infer<typeof headingSchema>
  | z.infer<typeof codeBlockSchema>
  | z.infer<typeof imageNodeSchema>
  | { type: 'bulletList'; content: RichTextListItem[] }
  | { type: 'orderedList'; attrs?: { start?: number | null }; content: RichTextListItem[] }
  | { type: 'blockquote'; content: RichTextBlock[] }

export type RichTextListItem = { type: 'listItem'; content: RichTextBlock[] }

export const blockSchema: z.ZodType<RichTextBlock> = z.lazy(() =>
  z.union([
    paragraphSchema,
    headingSchema,
    codeBlockSchema,
    imageNodeSchema,
    z.object({ type: z.literal('bulletList'), content: z.array(listItemSchema) }),
    z.object({
      type: z.literal('orderedList'),
      attrs: z.object({ start: z.number().int().nullable().optional() }).optional(),
      content: z.array(listItemSchema),
    }),
    z.object({ type: z.literal('blockquote'), content: z.array(blockSchema) }),
  ]),
)

export const listItemSchema: z.ZodType<RichTextListItem> = z.lazy(() =>
  z.object({ type: z.literal('listItem'), content: z.array(blockSchema) }),
)

export const richTextDocSchema = z.object({
  type: z.literal('doc'),
  content: z.array(blockSchema).max(2000),
})

export type RichTextDoc = z.infer<typeof richTextDocSchema>
export type RichTextMark = z.infer<typeof markSchema>
export type RichTextInline = z.infer<typeof inlineNodeSchema>

export function emptyDoc(): RichTextDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

export function textDoc(text: string): RichTextDoc {
  return {
    type: 'doc',
    content: text
      .split(/\n{2,}/)
      .filter((p) => p.trim().length > 0)
      .map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p.trim() }] })),
  }
}

function inlineText(nodes: readonly RichTextInline[] | undefined): string {
  if (!nodes) return ''
  return nodes.map((n) => (n.type === 'text' ? n.text : '\n')).join('')
}

function blockText(block: RichTextBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return inlineText(block.content)
    case 'codeBlock':
      return (block.content ?? []).map((n) => n.text).join('')
    case 'image':
      return block.attrs.alt ?? ''
    case 'bulletList':
    case 'orderedList':
      return block.content.map((item) => item.content.map(blockText).join('\n')).join('\n')
    case 'blockquote':
      return block.content.map(blockText).join('\n')
  }
}

export function toPlainText(doc: RichTextDoc | null | undefined): string {
  if (!doc) return ''
  return doc.content
    .map(blockText)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function isEmptyDoc(doc: RichTextDoc | null | undefined): boolean {
  if (!doc) return true
  return toPlainText(doc).length === 0 && !doc.content.some((b) => b.type === 'image')
}

/** Rough reading time at 200 wpm, in whole minutes (minimum 1 when there is any text). */
export function readingMinutes(doc: RichTextDoc | null | undefined): number {
  const words = toPlainText(doc).split(/\s+/).filter(Boolean).length
  return words === 0 ? 0 : Math.max(1, Math.round(words / 200))
}
