import type { RichTextBlock, RichTextDoc, RichTextInline } from '@elevate/core'
import { Image } from 'expo-image'
import type { ReactNode } from 'react'
import { Linking, Text, type TextStyle, View } from 'react-native'
import type { Theme } from '@/theme'
import { useTheme } from '@/theme/ThemeProvider'

function inlineNodes(nodes: readonly RichTextInline[] | undefined, theme: Theme): ReactNode {
  if (!nodes) return null
  return nodes.map((node, i) => {
    const key = `${i}-${node.type}`
    if (node.type === 'hardBreak') return <Text key={key}>{'\n'}</Text>
    const style: TextStyle = {}
    let href: string | null = null
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') style.fontFamily = theme.text.bodyStrong.fontFamily
      if (mark.type === 'italic') style.fontStyle = 'italic'
      if (mark.type === 'underline') style.textDecorationLine = 'underline'
      if (mark.type === 'strike') style.textDecorationLine = 'line-through'
      if (mark.type === 'code') {
        style.fontFamily = theme.text.eyebrow.fontFamily
        style.backgroundColor = theme.colors.surfaceMuted
      }
      if (mark.type === 'link') {
        href = mark.attrs.href
        style.color = theme.colors.brand
        style.textDecorationLine = 'underline'
      }
    }
    const url = href
    return (
      <Text
        key={key}
        style={style}
        onPress={url ? () => Linking.openURL(url).catch(() => {}) : undefined}
      >
        {node.text}
      </Text>
    )
  })
}

function Block({ block, theme }: { block: RichTextBlock; theme: Theme }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <Text style={[theme.text.body, { color: theme.colors.ink }]}>
          {inlineNodes(block.content, theme)}
        </Text>
      )
    case 'heading': {
      const variant = block.attrs.level === 1 ? 'h1' : block.attrs.level === 2 ? 'h2' : 'h3'
      return (
        <Text style={[theme.text[variant], { color: theme.colors.ink, marginTop: theme.space[2] }]}>
          {inlineNodes(block.content, theme)}
        </Text>
      )
    }
    case 'bulletList':
    case 'orderedList':
      return (
        <View style={{ gap: theme.space[1] }}>
          {block.content.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static document content, never reordered
            <View key={i} style={{ flexDirection: 'row', gap: theme.space[2] }}>
              <Text style={[theme.text.body, { color: theme.colors.inkSecondary, width: 22 }]}>
                {block.type === 'orderedList' ? `${(block.attrs?.start ?? 1) + i}.` : '•'}
              </Text>
              <View style={{ flex: 1, gap: theme.space[1] }}>
                {item.content.map((inner, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static document content, never reordered
                  <Block key={j} block={inner} theme={theme} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )
    case 'blockquote':
      return (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.brand,
            backgroundColor: theme.colors.brandTint,
            paddingVertical: theme.space[2],
            paddingHorizontal: theme.space[3],
            borderRadius: theme.radii.sm,
            gap: theme.space[2],
          }}
        >
          {block.content.map((inner, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static document content, never reordered
            <Block key={j} block={inner} theme={theme} />
          ))}
        </View>
      )
    case 'codeBlock':
      return (
        <View
          style={{
            backgroundColor: theme.colors.surfaceSunken,
            padding: theme.space[3],
            borderRadius: theme.radii.control,
          }}
        >
          <Text
            style={[
              theme.text.small,
              { fontFamily: theme.text.eyebrow.fontFamily, color: theme.colors.ink },
            ]}
          >
            {(block.content ?? []).map((n) => n.text).join('')}
          </Text>
        </View>
      )
    case 'image':
      return (
        <Image
          source={{ uri: block.attrs.src }}
          accessibilityLabel={block.attrs.alt ?? undefined}
          style={{ width: '100%', height: 240, borderRadius: theme.radii.card }}
          contentFit="contain"
        />
      )
  }
}

/** Renders Elevate rich text (validated Tiptap JSON) with native primitives; works on web too. */
export function RichText({ doc }: { doc: RichTextDoc | null | undefined }) {
  const theme = useTheme()
  if (!doc) return null
  return (
    <View style={{ gap: theme.space[3] }}>
      {doc.content.map((block, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static document content, never reordered
        <Block key={i} block={block} theme={theme} />
      ))}
    </View>
  )
}
