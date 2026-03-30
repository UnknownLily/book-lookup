import { FILTER_GROUPS, findFilterDefinition, isListFilter } from '../config/filters'
import { t } from '../i18n'
import { getTagSuggestions } from './tagSuggestions'
import { cloneCriteria, getFieldLabel, normalizeTextList, type ListFilterKey, type SearchCriteriaDraft } from '../types/search'

interface KeywordMatch {
  key: ListFilterKey
  value: string
}

export interface KeywordSuggestion {
  key: ListFilterKey
  value: string
  fieldLabel: string
}

export interface KeywordResolutionResult {
  criteria: SearchCriteriaDraft
  noticeMessage: KeywordResolutionNotice | null
}

export interface KeywordResolutionNotice {
  mode: 'exact' | 'loose' | 'fallback'
  keyword: string
  match?: KeywordMatch
}

export class KeywordResolutionError extends Error {
  readonly kind: 'ambiguousFields' | 'ambiguousCandidates' | 'unrecognized'
  readonly keyword: string
  readonly matches: KeywordMatch[]

  constructor(kind: 'ambiguousFields' | 'ambiguousCandidates' | 'unrecognized', keyword: string, matches: KeywordMatch[] = []) {
    super(kind)
    this.name = 'KeywordResolutionError'
    this.kind = kind
    this.keyword = keyword
    this.matches = matches
  }
}

const REMOTE_RESOLUTION_KEYS: ListFilterKey[] = ['circle', 'event', 'coverchar']
const SUGGESTION_PRIORITY: ListFilterKey[] = ['circle', 'publisher', 'event', 'coverchar', 'character', 'eventname', 'session', 'type', 'size', 'number', 'rate', 'region', 'commercial']

function normalizeTerm(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

function isExactMatch(left: string, right: string): boolean {
  return normalizeTerm(left) === normalizeTerm(right)
}

function isLooseMatch(candidate: string, term: string): boolean {
  const normalizedCandidate = normalizeTerm(candidate)
  const normalizedTerm = normalizeTerm(term)
  return normalizedTerm.length > 0 && normalizedCandidate.includes(normalizedTerm)
}

function compareMatchPriority(left: KeywordMatch, right: KeywordMatch): number {
  const leftIndex = SUGGESTION_PRIORITY.indexOf(left.key)
  const rightIndex = SUGGESTION_PRIORITY.indexOf(right.key)
  return leftIndex - rightIndex || left.value.localeCompare(right.value, 'zh-CN')
}

function createResolvedCriteria(criteria: SearchCriteriaDraft, match: KeywordMatch): SearchCriteriaDraft {
  const nextCriteria = cloneCriteria(criteria)
  nextCriteria.keyword = ''
  nextCriteria[match.key] = normalizeTextList([...nextCriteria[match.key], match.value])
  return nextCriteria
}

export function formatKeywordResolutionNotice(notice: KeywordResolutionNotice): string {
  if (notice.mode === 'fallback' || !notice.match) {
    return t('keyword.fallbackSearch', { keyword: notice.keyword.trim() })
  }

  const fieldLabel = getFieldLabel(notice.match.key)
  if (notice.mode === 'exact') {
    return t('keyword.exactResolved', { keyword: notice.keyword.trim(), fieldLabel, value: notice.match.value })
  }

  return t('keyword.looseResolved', { keyword: notice.keyword.trim(), fieldLabel, value: notice.match.value })
}

function collectStaticMatches(term: string): KeywordMatch[] {
  const matches: KeywordMatch[] = []

  for (const group of FILTER_GROUPS) {
    for (const filter of group.filters) {
      if (!isListFilter(filter)) {
        continue
      }

      for (const item of filter.items) {
        if (isExactMatch(item, term)) {
          matches.push({
            key: filter.key,
            value: item,
          })
        }
      }
    }
  }

  return matches
}

async function collectRemoteMatches(term: string, signal?: AbortSignal): Promise<{ exactMatches: KeywordMatch[]; looseMatches: KeywordMatch[] }> {
  const exactMatches: KeywordMatch[] = []
  const looseMatches: KeywordMatch[] = []

  await Promise.all(
    REMOTE_RESOLUTION_KEYS.map(async (key) => {
      const filter = findFilterDefinition(key)
      if (!filter || !isListFilter(filter) || !filter.suggestionSource) {
        return
      }

      const result = await getTagSuggestions({
        term,
        staticItems: filter.items,
        suggestionSource: filter.suggestionSource,
        signal,
      })

      const exactValues = result.suggestions.filter((item) => isExactMatch(item, term))
      for (const value of exactValues) {
        exactMatches.push({ key, value })
      }

      if (exactValues.length === 0) {
        const looseValues = result.suggestions.filter((item) => isLooseMatch(item, term))
        if (looseValues.length === 1) {
          looseMatches.push({ key, value: looseValues[0] })
        }
      }
    }),
  )

  return { exactMatches, looseMatches }
}

function dedupeMatches(matches: KeywordMatch[]): KeywordMatch[] {
  const seen = new Set<string>()
  return matches.filter((match) => {
    const cacheKey = `${match.key}::${normalizeTerm(match.value)}`
    if (seen.has(cacheKey)) {
      return false
    }

    seen.add(cacheKey)
    return true
  })
}

function sortMatches(matches: KeywordMatch[]): KeywordMatch[] {
  return [...matches].sort(compareMatchPriority)
}

function selectPreferredMatch(matches: KeywordMatch[]): KeywordMatch | null {
  const uniqueMatches = sortMatches(dedupeMatches(matches))
  if (uniqueMatches.length === 1) {
    return uniqueMatches[0]
  }

  return null
}

function formatAmbiguousFields(matches: KeywordMatch[]): string {
  return sortMatches(dedupeMatches(matches))
    .map((match) => getFieldLabel(match.key))
    .join('、')
}

function formatAmbiguousCandidates(matches: KeywordMatch[]): string {
  return sortMatches(dedupeMatches(matches))
    .slice(0, 6)
    .map((match) => `${getFieldLabel(match.key)}：${match.value}`)
    .join('；')
}

export function formatKeywordResolutionError(error: KeywordResolutionError): string {
  switch (error.kind) {
    case 'ambiguousFields':
      return t('keyword.ambiguousFields', {
        keyword: error.keyword,
        fields: formatAmbiguousFields(error.matches),
        candidates: formatAmbiguousCandidates(error.matches),
      })
    case 'ambiguousCandidates':
      return t('keyword.ambiguousCandidates', {
        keyword: error.keyword,
        candidates: formatAmbiguousCandidates(error.matches),
      })
    case 'unrecognized':
      return t('keyword.unrecognized', { keyword: error.keyword })
  }
}

function toSuggestion(match: KeywordMatch): KeywordSuggestion {
  return {
    key: match.key,
    value: match.value,
    fieldLabel: getFieldLabel(match.key),
  }
}

function collectStaticSuggestions(term: string): KeywordMatch[] {
  const matches: KeywordMatch[] = []

  for (const group of FILTER_GROUPS) {
    for (const filter of group.filters) {
      if (!isListFilter(filter)) {
        continue
      }

      for (const item of filter.items) {
        if (isLooseMatch(item, term)) {
          matches.push({
            key: filter.key,
            value: item,
          })
        }
      }
    }
  }

  return matches
}

export async function getKeywordSuggestions(term: string, signal?: AbortSignal): Promise<KeywordSuggestion[]> {
  const keyword = term.trim()
  if (!keyword) {
    return []
  }

  const matches = collectStaticSuggestions(keyword)

  await Promise.all(
    REMOTE_RESOLUTION_KEYS.map(async (key) => {
      const filter = findFilterDefinition(key)
      if (!filter || !isListFilter(filter) || !filter.suggestionSource) {
        return
      }

      const result = await getTagSuggestions({
        term: keyword,
        staticItems: filter.items,
        suggestionSource: filter.suggestionSource,
        signal,
      })

      for (const value of result.suggestions.slice(0, 4)) {
        matches.push({ key, value })
      }
    }),
  )

  return sortMatches(dedupeMatches(matches)).slice(0, 12).map(toSuggestion)
}

export async function resolveKeywordCriteria(criteria: SearchCriteriaDraft, signal?: AbortSignal): Promise<KeywordResolutionResult> {
  const keyword = criteria.keyword.trim()
  if (!keyword) {
    return {
      criteria: cloneCriteria(criteria),
      noticeMessage: null,
    }
  }

  const staticMatches = collectStaticMatches(keyword)
  const remoteMatches = await collectRemoteMatches(keyword, signal)
  const exactMatches = dedupeMatches([...staticMatches, ...remoteMatches.exactMatches])
  const preferredExactMatch = selectPreferredMatch(exactMatches)

  if (preferredExactMatch) {
    return {
      criteria: createResolvedCriteria(criteria, preferredExactMatch),
      noticeMessage: { mode: 'exact', keyword, match: preferredExactMatch },
    }
  }

  if (exactMatches.length > 1) {
    throw new KeywordResolutionError('ambiguousFields', keyword, exactMatches)
  }

  const looseMatches = dedupeMatches(remoteMatches.looseMatches)
  const preferredLooseMatch = selectPreferredMatch(looseMatches)
  if (preferredLooseMatch) {
    return {
      criteria: createResolvedCriteria(criteria, preferredLooseMatch),
      noticeMessage: { mode: 'loose', keyword, match: preferredLooseMatch },
    }
  }

  if (looseMatches.length > 1) {
    throw new KeywordResolutionError('ambiguousCandidates', keyword, looseMatches)
  }

  return {
    criteria: cloneCriteria(criteria),
    noticeMessage: { mode: 'fallback', keyword },
  }
}
