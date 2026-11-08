import { describe, expect, it } from 'vitest'
import {
  isEmptyDoc,
  readingMinutes,
  richTextDocSchema,
  textDoc,
  toPlainText,
} from '../src/domain/richtext'

describe('richtext', () => {
  it('accepts the supported Tiptap subset and extracts text', () => {
    const doc = richTextDocSchema.parse({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Welcome' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ', marks: [{ type: 'bold' }] },
            {
              type: 'text',
              text: 'world',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
            },
          ],
        },
        { type: 'image', attrs: { src: 'https://img/x.png', alt: 'a picture' } },
      ],
    })
    expect(toPlainText(doc)).toBe('Welcome\nHello world\none\na picture')
    expect(isEmptyDoc(doc)).toBe(false)
  })

  it('rejects unsupported nodes and deep headings', () => {
    expect(richTextDocSchema.safeParse({ type: 'doc', content: [{ type: 'table' }] }).success).toBe(
      false,
    )
    expect(
      richTextDocSchema.safeParse({
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 5 } }],
      }).success,
    ).toBe(false)
  })

  it('detects empty docs and estimates reading time', () => {
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true)
    const long = textDoc(Array.from({ length: 450 }, () => 'word').join(' '))
    expect(readingMinutes(long)).toBe(2)
    expect(readingMinutes(null)).toBe(0)
  })
})
