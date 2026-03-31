import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import {
  LIST_FILTER_KEYS,
  RANGE_FILTER_KEYS,
  cloneCriteria,
  createDefaultCriteria,
  isListAtDefault,
  normalizeListFilterSelection,
  type SearchCriteriaDraft,
  type ViewMode,
} from '../types/search'

function pickFirst(queryValue: LocationQuery[string]): string | null {
  if (Array.isArray(queryValue)) {
    return queryValue[0] ?? null
  }

  return queryValue ?? null
}

function parseRange(value: string | null, fallback: [number, number]): [number, number] {
  if (!value) {
    return [...fallback] as [number, number]
  }

  const [start, end] = value.split(':').map((item) => Number.parseFloat(item))
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return [...fallback] as [number, number]
  }

  return [start, end]
}

function parseList(key: (typeof LIST_FILTER_KEYS)[number], value: string | null): string[] {
  if (!value) {
    return normalizeListFilterSelection(key, [])
  }

  return normalizeListFilterSelection(key, value.split(','))
}

export function parseSearchRouteQuery(query: LocationQuery): { criteria: SearchCriteriaDraft; viewMode: ViewMode } {
  const base = createDefaultCriteria()
  const criteria = cloneCriteria(base)

  criteria.keyword = (pickFirst(query.q) ?? '').trim()

  for (const key of RANGE_FILTER_KEYS) {
    criteria[key] = parseRange(pickFirst(query[key]), base[key])
  }

  for (const key of LIST_FILTER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      criteria[key] = parseList(key, pickFirst(query[key]))
    }
  }

  const viewMode = pickFirst(query.view) === 'list' ? 'list' : 'card'

  return { criteria, viewMode }
}

export function buildSearchRouteQuery(criteria: SearchCriteriaDraft, viewMode: ViewMode): LocationQueryRaw {
  const query: LocationQueryRaw = {}

  if (criteria.keyword.trim()) {
    query.q = criteria.keyword.trim()
  }

  for (const key of RANGE_FILTER_KEYS) {
    const value = criteria[key]
    const fallback = createDefaultCriteria()[key]
    if (value[0] !== fallback[0] || value[1] !== fallback[1]) {
      query[key] = `${value[0]}:${value[1]}`
    }
  }

  for (const key of LIST_FILTER_KEYS) {
    if (!isListAtDefault(key, criteria[key])) {
      query[key] = criteria[key].length > 0 ? criteria[key].join(',') : ''
    }
  }

  if (viewMode === 'list') {
    query.view = 'list'
  }

  return query
}

export function routeQuerySignature(query: LocationQuery | LocationQueryRaw): string {
  const entries = Object.entries(query)
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value ?? ''])
    .sort(([left], [right]) => String(left).localeCompare(String(right)))

  return JSON.stringify(entries)
}
