import type { CertificateView } from '@elevate/core'
import * as WebBrowser from 'expo-web-browser'
import { Award, Check, Download, Share2 } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, Share, View } from 'react-native'
import { formatDate } from '@/lib/format'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Logo, Text, toneColor } from '@/ui'

export type CertificateCardData = Pick<
  CertificateView,
  'learnerName' | 'courseTitle' | 'teacherName' | 'issuedAt' | 'token'
>

/** The on-screen twin of the PDF: same wording, same Atelier framing. */
export function CertificateCard({ certificate: c }: { certificate: CertificateCardData }) {
  const theme = useTheme()
  return (
    <View
      style={{
        borderWidth: 2,
        borderColor: theme.colors.brand,
        borderRadius: theme.radii.card,
        padding: 6,
        backgroundColor: theme.colors.surface,
      }}
    >
      <View
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.card - 4,
          paddingVertical: theme.space[8],
          paddingHorizontal: theme.space[6],
          gap: theme.space[3],
          alignItems: 'center',
        }}
      >
        <View style={{ alignSelf: 'flex-start' }}>
          <Logo size="sm" />
        </View>
        <Text variant="eyebrow" tone="brand" align="center" style={{ marginTop: theme.space[2] }}>
          Certificate of completion
        </Text>
        <Text variant="small" tone="secondary" align="center">
          This certifies that
        </Text>
        <Text variant="display" align="center">
          {c.learnerName}
        </Text>
        <View style={{ width: 160, height: 1, backgroundColor: theme.colors.border }} />
        <Text variant="small" tone="secondary" align="center">
          has completed
        </Text>
        <Text variant="h2" align="center">
          {c.courseTitle}
        </Text>
        <Text variant="small" tone="secondary" align="center">
          taught by {c.teacherName} on Elevate
        </Text>
        <Text variant="bodyStrong" align="center">
          {formatDate(c.issuedAt)}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: theme.space[3],
          }}
        >
          <Award size={14} color={toneColor(theme, 'tertiary')} />
          <Text variant="caption" tone="tertiary">
            Certificate ID {c.token}
          </Text>
        </View>
      </View>
    </View>
  )
}

export function CertificateActions({
  certificate: c,
  share = true,
}: {
  certificate: Pick<CertificateView, 'pdfUrl' | 'verifyUrl' | 'courseTitle'>
  share?: boolean
}) {
  const theme = useTheme()
  const [copied, setCopied] = useState(false)

  async function openPdf() {
    if (Platform.OS === 'web') {
      window.open(c.pdfUrl, '_blank', 'noopener')
      return
    }
    await WebBrowser.openBrowserAsync(c.pdfUrl)
  }

  async function shareLink() {
    const message = `I completed “${c.courseTitle}” on Elevate. Verify it here: ${c.verifyUrl}`
    if (Platform.OS !== 'web') {
      await Share.share({ message, url: c.verifyUrl })
      return
    }
    const nav = typeof navigator === 'undefined' ? null : navigator
    if (nav?.share) {
      try {
        await nav.share({ title: 'Elevate certificate', text: message, url: c.verifyUrl })
        return
      } catch {
        // user dismissed the share sheet; fall through to copying
      }
    }
    await nav?.clipboard?.writeText(c.verifyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
      <Button label="Download PDF" variant="primary" icon={Download} onPress={openPdf} />
      {share ? (
        <Button
          label={copied ? 'Link copied' : 'Share verify link'}
          variant="secondary"
          icon={copied ? Check : Share2}
          onPress={shareLink}
        />
      ) : null}
    </View>
  )
}
