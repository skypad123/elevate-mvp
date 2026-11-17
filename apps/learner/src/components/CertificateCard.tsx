import type { CertificateView } from '@elevate/core'
import { fillSlots } from '@elevate/i18n/react'
import * as WebBrowser from 'expo-web-browser'
import { Award, Check, Download, Share2 } from 'lucide-react-native'
import { Fragment, useState } from 'react'
import { Platform, Share, View } from 'react-native'
import { formatDate } from '@/lib/format'
import { usePreferences } from '@/lib/preferences'
import { useTheme } from '@/theme/ThemeProvider'
import { Button, Logo, Text, toneColor } from '@/ui'

export type CertificateCardData = Pick<
  CertificateView,
  'learnerName' | 'courseTitle' | 'teacherName' | 'issuedAt' | 'token'
>

/** The name and the course in the statement, each laid out as its own large line. */
const STATEMENT_LINE = /(\{name\}|\{course\})/

/** The on-screen twin of the PDF: same wording, same Atelier framing. */
export function CertificateCard({ certificate: c }: { certificate: CertificateCardData }) {
  const theme = useTheme()
  const { t, locale } = usePreferences()
  // One sentence, in the language's own order, split into the card's lines around the name and
  // the course; the text between them is the small lines. A translation can repeat a small
  // fragment, so each part's key counts the earlier parts with the same text.
  const seen = new Map<string, number>()
  const statement = t('learnerCertificate.card.statement')
    .split(STATEMENT_LINE)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const n = seen.get(part) ?? 0
      seen.set(part, n + 1)
      return { part, key: `${part}#${n}` }
    })
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
          {t('learnerCertificate.card.eyebrow')}
        </Text>
        {statement.map(({ part, key }) =>
          part === '{name}' ? (
            <Fragment key={key}>
              <Text variant="display" align="center">
                {c.learnerName}
              </Text>
              <View style={{ width: 160, height: 1, backgroundColor: theme.colors.border }} />
            </Fragment>
          ) : part === '{course}' ? (
            <Text key={key} variant="h2" align="center">
              {c.courseTitle}
            </Text>
          ) : (
            <Text key={key} variant="small" tone="secondary" align="center">
              {fillSlots(part, { teacher: c.teacherName })}
            </Text>
          ),
        )}
        <Text variant="bodyStrong" align="center">
          {formatDate(c.issuedAt, locale)}
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
            {t('learnerCertificate.card.id', { token: c.token })}
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
  const { t } = usePreferences()
  const [copied, setCopied] = useState(false)

  async function openPdf() {
    if (Platform.OS === 'web') {
      window.open(c.pdfUrl, '_blank', 'noopener')
      return
    }
    await WebBrowser.openBrowserAsync(c.pdfUrl)
  }

  async function shareLink() {
    const message = t('learnerCertificate.card.shareMessage', {
      course: c.courseTitle,
      url: c.verifyUrl,
    })
    if (Platform.OS !== 'web') {
      await Share.share({ message, url: c.verifyUrl })
      return
    }
    const nav = typeof navigator === 'undefined' ? null : navigator
    if (nav?.share) {
      try {
        await nav.share({
          title: t('learnerCertificate.card.shareTitle'),
          text: message,
          url: c.verifyUrl,
        })
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
      <Button
        label={t('learnerCertificate.card.download')}
        variant="primary"
        icon={Download}
        onPress={openPdf}
      />
      {share ? (
        <Button
          label={t(copied ? 'learnerCertificate.card.copied' : 'learnerCertificate.card.share')}
          variant="secondary"
          icon={copied ? Check : Share2}
          onPress={shareLink}
        />
      ) : null}
    </View>
  )
}
