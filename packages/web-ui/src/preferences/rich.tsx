import { createElement, Fragment, type ReactNode } from 'react'

const SLOT = /(\{\w+\})/

/**
 * Puts React nodes into the `{slot}` placeholders of a translated sentence, for a sentence with a
 * link, a button or bold text inside it:
 *
 *     fillSlots(t('invitation.notYou'), { signOut: <button onClick={signOut}>{t('nav.signOut')}</button> })
 *
 * The sentence stays one message, so a translation can put the slot wherever its grammar wants
 * it. Call `t` without variables and pass every value here, names and dates included: text that
 * a person typed is then never read as a placeholder. A slot with no node is left as it is.
 */
export function fillSlots(template: string, slots: Record<string, ReactNode>): ReactNode {
  const children = template.split(SLOT).map((part) => {
    const name = part.startsWith('{') && part.endsWith('}') ? part.slice(1, -1) : undefined
    return name !== undefined && name in slots ? slots[name] : part
  })
  return createElement(Fragment, null, ...children)
}
