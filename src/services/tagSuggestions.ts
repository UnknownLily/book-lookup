import { t } from '../i18n'

const SUGGEST_API = import.meta.env.DEV ? '/api/ajax.php' : 'https://thwiki.cc/ajax.php'
const DEFAULT_LIMIT = 24
const suggestionCache = new Map<string, string[]>()

export type TagSuggestionSource = 'local' | 'remote' | 'mixed'

export interface TagSuggestionResult {
  suggestions: string[]
  source: TagSuggestionSource
  remoteAvailable: boolean
  errorMessage: string | null
}

interface SuggestionEntry {
  value: string
  aliases: string[]
  title: string
}

function normalize(values: string[]): string[] {
  const seen = new Set<string>()

  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => {
      if (seen.has(value)) {
        return false
      }

      seen.add(value)
      return true
    })
}

function normalizeEntry(entry: SuggestionEntry): SuggestionEntry {
  return {
    value: entry.value.trim(),
    aliases: normalize(entry.aliases),
    title: entry.title.trim(),
  }
}

function createStaticEntries(source: string[]): SuggestionEntry[] {
  return normalize(source).map((value) => ({
    value,
    aliases: [],
    title: value,
  }))
}

function parseAliases(raw: string | null): string[] {
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? normalize(parsed.map((value) => String(value))) : []
  } catch {
    return []
  }
}

function parseSuggestionHtml(html: string): SuggestionEntry[] {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const nodes = Array.from(document.querySelectorAll('div[data-value], div'))
  const entries = nodes
    .map((node) => {
      const value = (node.getAttribute('data-value') || node.textContent || '').trim()
      if (!value) {
        return null
      }

      return normalizeEntry({
        value,
        aliases: parseAliases(node.getAttribute('data-values')),
        title: node.getAttribute('title') || value,
      })
    })
    .filter((entry): entry is SuggestionEntry => entry !== null)

  const seen = new Set<string>()
  return entries.filter((entry) => {
    if (seen.has(entry.value)) {
      return false
    }

    seen.add(entry.value)
    return true
  })
}

function localSearch(term: string, source: SuggestionEntry[]): string[] {
  if (!term.trim()) {
    return source.map((entry) => entry.value).slice(0, DEFAULT_LIMIT)
  }

  const segments = term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (segments.length === 0) {
    return source.map((entry) => entry.value).slice(0, DEFAULT_LIMIT)
  }

  return source
    .filter((entry) => {
      const searchable = [entry.value, entry.title, ...entry.aliases].join(' ').toLowerCase()
      return segments.every((segment) => searchable.includes(segment))
    })
    .map((entry) => entry.value)
    .slice(0, DEFAULT_LIMIT)
}

async function remoteSearch(sourceTitle: string, term: string, signal?: AbortSignal): Promise<string[]> {
  if (!term.trim()) {
    return []
  }

  const cacheKey = `${sourceTitle}::${term.trim().toLowerCase()}`
  const cached = suggestionCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const query = new URLSearchParams({
    action: 'inopt',
    title: sourceTitle,
    value: term,
  })

  const response = await fetch(`${SUGGEST_API}?${query.toString()}`, { signal })
  if (!response.ok) {
    throw new Error(t('errors.tagSuggestionFailed', { status: response.status }))
  }

  const html = await response.text()
  const suggestions = parseSuggestionHtml(html)
    .map((entry) => entry.value)
    .slice(0, DEFAULT_LIMIT)

  suggestionCache.set(cacheKey, suggestions)
  return suggestions
}

export async function getTagSuggestions(options: {
  term: string
  staticItems?: string[]
  selected?: string[]
  suggestionSource?: string
  signal?: AbortSignal
}): Promise<TagSuggestionResult> {
  const staticEntries = createStaticEntries(options.staticItems ?? [])
  const selectedEntries = createStaticEntries(options.selected ?? [])
  const localMatches = localSearch(options.term, [...selectedEntries, ...staticEntries])

  if (!options.suggestionSource) {
    return {
      suggestions: localMatches,
      source: 'local',
      remoteAvailable: false,
      errorMessage: null,
    }
  }

  try {
    const remoteMatches = await remoteSearch(options.suggestionSource, options.term, options.signal)
    const suggestions = normalize([...selectedEntries.map((entry) => entry.value), ...remoteMatches, ...localMatches]).slice(0, DEFAULT_LIMIT)
    return {
      suggestions,
      source: localMatches.length > 0 ? 'mixed' : 'remote',
      remoteAvailable: true,
      errorMessage: null,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    return {
      suggestions: localMatches,
      source: 'local',
      remoteAvailable: false,
      errorMessage: error instanceof Error ? error.message : t('errors.suggestionUnavailable'),
    }
  }
}
