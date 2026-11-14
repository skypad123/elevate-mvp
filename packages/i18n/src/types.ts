import type { en } from './messages/en'

export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>
export type MessageVars = Record<string, string | number>
