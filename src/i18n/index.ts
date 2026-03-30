import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { messages } from './messages'

export interface MessageDescriptor {
  key: string
  params?: Record<string, MessageValue>
}

export type MessageValue = string | number | boolean | null | undefined | MessageDescriptor
export type MessageLike = string | MessageDescriptor | null

export class LocalizedError extends Error {
  readonly descriptor: MessageDescriptor

  constructor(descriptor: MessageDescriptor) {
    super(descriptor.key)
    this.name = 'LocalizedError'
    this.descriptor = descriptor
  }
}

export const SUPPORTED_LOCALES = ['zh-Hans', 'zh-Hant', 'ja', 'en'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

const DEFAULT_LOCALE: SupportedLocale = 'zh-Hans'
const STORAGE_KEY = 'book-lookup-locale'

const HTML_LANG_MAP: Record<SupportedLocale, string> = {
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  ja: 'ja-JP',
  en: 'en-US',
}

const OG_LOCALE_MAP: Record<SupportedLocale, string> = {
  'zh-Hans': 'zh_CN',
  'zh-Hant': 'zh_TW',
  ja: 'ja_JP',
  en: 'en_US',
}

function matchBrowserLocale(language: string): SupportedLocale {
  const normalized = language.toLowerCase()

  if (normalized.startsWith('zh-hk') || normalized.startsWith('zh-tw') || normalized.startsWith('zh-mo')) {
    return 'zh-Hant'
  }

  if (normalized.startsWith('ja')) {
    return 'ja'
  }

  if (normalized.startsWith('en')) {
    return 'en'
  }

  if (normalized.startsWith('zh')) {
    return 'zh-Hans'
  }

  return DEFAULT_LOCALE
}

function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
    return stored as SupportedLocale
  }

  const languages = window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language]
  for (const language of languages) {
    const matched = matchBrowserLocale(language)
    if (matched) {
      return matched
    }
  }

  return DEFAULT_LOCALE
}

export const currentLocale = ref<SupportedLocale>(detectLocale())

export const localeOptions = [
  { value: 'zh-Hans', labelKey: 'locale.zhHans' },
  { value: 'zh-Hant', labelKey: 'locale.zhHant' },
  { value: 'ja', labelKey: 'locale.ja' },
  { value: 'en', labelKey: 'locale.en' },
] as const satisfies Array<{ value: SupportedLocale; labelKey: string }>

export const i18n = createI18n({
  legacy: false,
  locale: currentLocale.value,
  fallbackLocale: DEFAULT_LOCALE,
  messages,
})

function syncDocumentLocale(locale: SupportedLocale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = HTML_LANG_MAP[locale]
  }
}

export function setLocale(locale: SupportedLocale): void {
  currentLocale.value = locale
  i18n.global.locale.value = locale
  syncDocumentLocale(locale)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, locale)
  }
}

syncDocumentLocale(currentLocale.value)

export function t(key: string, params?: Record<string, unknown>): string {
  return params ? (i18n.global.t(key, params) as string) : (i18n.global.t(key) as string)
}

export function createMessage(key: string, params?: Record<string, MessageValue>): MessageDescriptor {
  return { key, params }
}

function resolveMessageValue(value: MessageValue): unknown {
  if (value && typeof value === 'object' && 'key' in value) {
    return resolveMessage(value as MessageDescriptor) ?? ''
  }

  return value
}

export function resolveMessage(message: MessageLike): string | null {
  currentLocale.value

  if (message == null) {
    return null
  }

  if (typeof message === 'string') {
    return message
  }

  const resolvedParams = message.params
    ? Object.fromEntries(Object.entries(message.params).map(([key, value]) => [key, resolveMessageValue(value)]))
    : undefined

  return t(message.key, resolvedParams)
}

export function getCurrentIntlLocale(): string {
  return HTML_LANG_MAP[currentLocale.value]
}

export function getCurrentHtmlLang(): string {
  return HTML_LANG_MAP[currentLocale.value]
}

export function getCurrentOgLocale(): string {
  return OG_LOCALE_MAP[currentLocale.value]
}
