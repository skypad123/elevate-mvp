import { emptyDoc, type RichTextDoc, richTextDocSchema } from '@elevate/core'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

export type RichTextEditorProps = {
  value: RichTextDoc | null | undefined
  onChange: (doc: RichTextDoc) => void
  placeholder?: string
  disabled?: boolean
  /** Returns a public image URL after uploading, or null to cancel. */
  onPickImage?: () => Promise<string | null>
  minHeight?: number
  className?: string
}

/**
 * Tiptap editor constrained to the node set @elevate/core validates. Emits debounced JSON only
 * when it passes the schema, so the API never sees an unsupported node.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  onPickImage,
  minHeight = 220,
  className,
}: RichTextEditorProps) {
  const timer = useRef<number | null>(null)
  const [invalid, setInvalid] = useState(false)

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write here…' }),
    ],
    content: value ?? emptyDoc(),
    editorProps: {
      attributes: {
        class: 'prose-elevate focus:outline-none',
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => {
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        const parsed = richTextDocSchema.safeParse(editor.getJSON())
        setInvalid(!parsed.success)
        if (parsed.success) onChange(parsed.data)
      }, 600)
    },
  })

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  if (!editor)
    return <div className="rounded-card border border-border bg-surface" style={{ minHeight }} />

  const tool = (label: string, icon: React.ReactNode, active: boolean, run: () => void) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={cn(
        'rounded-sm p-1.5 text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-50',
        active && 'bg-brand-tint text-brand',
      )}
    >
      {icon}
    </button>
  )

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', previous ?? 'https://')
    if (url === null) return
    if (url.trim() === '') editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const addImage = async () => {
    if (!onPickImage) return
    const url = await onPickImage()
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  return (
    <div
      className={cn(
        'rounded-card border border-border-strong bg-surface focus-within:border-brand',
        invalid && 'border-danger',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
        {tool('Bold', <Bold className="size-4" />, editor.isActive('bold'), () =>
          editor.chain().focus().toggleBold().run(),
        )}
        {tool('Italic', <Italic className="size-4" />, editor.isActive('italic'), () =>
          editor.chain().focus().toggleItalic().run(),
        )}
        {tool('Inline code', <Code className="size-4" />, editor.isActive('code'), () =>
          editor.chain().focus().toggleCode().run(),
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        {tool(
          'Heading 2',
          <Heading2 className="size-4" />,
          editor.isActive('heading', { level: 2 }),
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        )}
        {tool(
          'Heading 3',
          <Heading3 className="size-4" />,
          editor.isActive('heading', { level: 3 }),
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        {tool('Bullet list', <List className="size-4" />, editor.isActive('bulletList'), () =>
          editor.chain().focus().toggleBulletList().run(),
        )}
        {tool(
          'Numbered list',
          <ListOrdered className="size-4" />,
          editor.isActive('orderedList'),
          () => editor.chain().focus().toggleOrderedList().run(),
        )}
        {tool('Quote', <Quote className="size-4" />, editor.isActive('blockquote'), () =>
          editor.chain().focus().toggleBlockquote().run(),
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        {tool('Link', <Link2 className="size-4" />, editor.isActive('link'), setLink)}
        {onPickImage
          ? tool('Image', <ImagePlus className="size-4" />, false, () => void addImage())
          : null}
        <span className="ml-auto flex items-center gap-0.5">
          {tool('Undo', <Undo2 className="size-4" />, false, () =>
            editor.chain().focus().undo().run(),
          )}
          {tool('Redo', <Redo2 className="size-4" />, false, () =>
            editor.chain().focus().redo().run(),
          )}
        </span>
      </div>
      <EditorContent editor={editor} className="px-4 py-3" />
      {invalid ? (
        <p className="border-t border-danger px-4 py-2 text-caption text-danger">
          This content uses something Elevate cannot display yet; the last valid version is kept.
        </p>
      ) : null}
    </div>
  )
}
