import type { RichTextBlock, RichTextDoc, RichTextInline } from '@elevate/core'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

function renderInline(nodes: readonly RichTextInline[] | undefined): ReactNode {
  if (!nodes) return null
  return nodes.map((node, index) => {
    const key = `${index}-${node.type}`
    if (node.type === 'hardBreak') return <br key={key} />
    let el: ReactNode = node.text
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case 'bold':
          el = <strong key={key}>{el}</strong>
          break
        case 'italic':
          el = <em key={key}>{el}</em>
          break
        case 'underline':
          el = <u key={key}>{el}</u>
          break
        case 'strike':
          el = <s key={key}>{el}</s>
          break
        case 'code':
          el = (
            <code
              key={key}
              className="rounded-sm bg-surface-muted px-1 py-0.5 font-mono text-[0.9em]"
            >
              {el}
            </code>
          )
          break
        case 'link':
          el = (
            <a
              key={key}
              href={mark.attrs.href}
              target="_blank"
              rel="noreferrer"
              className="text-brand underline underline-offset-2"
            >
              {el}
            </a>
          )
          break
      }
    }
    return <span key={key}>{el}</span>
  })
}

function renderBlock(block: RichTextBlock, index: number): ReactNode {
  const key = `${index}-${block.type}`
  switch (block.type) {
    case 'paragraph':
      return (
        <p key={key} className="text-body leading-7 text-ink">
          {renderInline(block.content)}
        </p>
      )
    case 'heading': {
      const cls =
        block.attrs.level === 1
          ? 'text-h1 mt-6'
          : block.attrs.level === 2
            ? 'text-h2 mt-5'
            : 'text-h3 mt-4'
      const Tag = `h${block.attrs.level}` as 'h1' | 'h2' | 'h3'
      return (
        <Tag key={key} className={cn('font-display font-semibold text-ink', cls)}>
          {renderInline(block.content)}
        </Tag>
      )
    }
    case 'bulletList':
      return (
        <ul key={key} className="list-disc space-y-1 pl-6 text-body text-ink">
          {block.content.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static document content, never reordered
            <li key={`${key}-${i}`}>{item.content.map(renderBlock)}</li>
          ))}
        </ul>
      )
    case 'orderedList':
      return (
        <ol
          key={key}
          start={block.attrs?.start ?? undefined}
          className="list-decimal space-y-1 pl-6 text-body text-ink"
        >
          {block.content.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static document content, never reordered
            <li key={`${key}-${i}`}>{item.content.map(renderBlock)}</li>
          ))}
        </ol>
      )
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="border-l-4 border-brand bg-brand-tint/40 py-2 pl-4 pr-3 text-ink-secondary"
        >
          {block.content.map(renderBlock)}
        </blockquote>
      )
    case 'codeBlock':
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-card bg-surface-sunken p-4 font-mono text-small text-ink"
        >
          <code>{(block.content ?? []).map((n) => n.text).join('')}</code>
        </pre>
      )
    case 'image':
      return (
        <img
          key={key}
          src={block.attrs.src}
          alt={block.attrs.alt ?? ''}
          className="my-2 max-h-[480px] rounded-card object-contain"
        />
      )
  }
}

/** Renders Elevate rich text (validated Tiptap JSON) without running an editor. */
export function RichTextView({
  doc,
  className,
}: {
  doc: RichTextDoc | null | undefined
  className?: string
}) {
  if (!doc) return null
  return <div className={cn('space-y-3', className)}>{doc.content.map(renderBlock)}</div>
}
