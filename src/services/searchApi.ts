import {
  LIST_FILTER_KEYS,
  RANGE_BOUNDS,
  isRangeAtDefault,
  hasActiveCriteria,
  normalizeListFilterSelection,
  type ApiCriteriaPayload,
  type CountResponse,
  type ItemField,
  type QueryResponse,
  type RangeFilterKey,
  type SearchCriteriaDraft,
} from '../types/search'
import { LocalizedError, createMessage } from '../i18n'

const API_BASE = import.meta.env.DEV ? '/api/askbook/v0' : 'https://thwiki.cc/rest/askbook/v0'
const PRINT_FIELDS: ItemField[] = [
  'name',
  'alias',
  'type',
  'character',
  'size',
  'commercial',
  'pages',
  'number',
  'circle',
  'publisher',
  'event',
  'eventname',
  'date',
  'year',
  'rate',
  'official',
  'remark',
  'coverchar',
  'covercharnum',
  'cover',
  'cover2x',
  'cover3x',
  'region',
  'establish',
  'session',
  'website',
]

function buildApiUrl(endpoint: string): string {
  if (import.meta.env.DEV) {
    return `${API_BASE}${endpoint}`
  }

  const origin = encodeURIComponent(window.location.origin).replace(/\./g, '%2E')
  const divider = endpoint.includes('?') ? '&' : '?'
  return `${API_BASE}${endpoint}${divider}origin=${origin}`
}

function buildRangeCriteria(key: RangeFilterKey, value: [number, number]): string[] | null {
  const [start, end] = value
  const bounds = RANGE_BOUNDS[key]

  if (isRangeAtDefault(key, value)) {
    return null
  }

  if (start === end) {
    return start === 0 ? ['=', start.toString()] : [start.toString()]
  }

  if (start === bounds.min) {
    return [`<=${end}`]
  }

  if (end === bounds.max) {
    return [`>=${start}`]
  }

  return [`>=${start}`, `<=${end}`]
}

function createPrintPayload(): ApiCriteriaPayload {
  return Object.fromEntries(PRINT_FIELDS.map((field) => [field, null])) as ApiCriteriaPayload
}

function createCriteriaPayload(criteria: SearchCriteriaDraft, options: { includePrintFields: boolean }): ApiCriteriaPayload | null {
  if (!hasActiveCriteria(criteria)) {
    return null
  }

  const payload = options.includePrintFields ? createPrintPayload() : {}

  if (criteria.keyword.trim()) {
    payload.searchkey = [criteria.keyword.trim()]
  }

  for (const key of Object.keys(RANGE_BOUNDS) as RangeFilterKey[]) {
    const criteriaValue = buildRangeCriteria(key, criteria[key])
    if (criteriaValue) {
      payload[key as ItemField] = criteriaValue
    }
  }

  for (const key of LIST_FILTER_KEYS) {
    const normalizedValues = normalizeListFilterSelection(key, criteria[key])

    if (normalizedValues.length > 0) {
      payload[key as ItemField] = [...normalizedValues]
    }
  }

  return payload
}

export function toApiCriteria(criteria: SearchCriteriaDraft): ApiCriteriaPayload | null {
  return createCriteriaPayload(criteria, { includePrintFields: true })
}

function toCountCriteria(criteria: SearchCriteriaDraft): ApiCriteriaPayload | null {
  return createCriteriaPayload(criteria, { includePrintFields: false })
}

export async function fetchSearchPage(
  criteria: SearchCriteriaDraft,
  options: { offset?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<QueryResponse> {
  const payload = toApiCriteria(criteria)

  if (!payload) {
    throw new LocalizedError(createMessage('errors.atLeastOneCriteria'))
  }

  const offset = options.offset ?? 0
  const limit = options.limit ?? 24
  const response = await fetch(buildApiUrl(`/query?mode=book&limit=${limit}&offset=${offset}`), {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: options.signal,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json;charset=UTF-8',
    },
  })

  if (!response.ok) {
    throw new LocalizedError(createMessage('errors.apiRequestFailed', { status: response.status }))
  }

  return (await response.json()) as QueryResponse
}

export async function fetchSearchCount(criteria: SearchCriteriaDraft, options: { signal?: AbortSignal } = {}): Promise<CountResponse> {
  const payload = toCountCriteria(criteria)

  if (!payload) {
    throw new LocalizedError(createMessage('errors.atLeastOneCriteria'))
  }

  const response = await fetch(buildApiUrl('/count?mode=book'), {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: options.signal,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json;charset=UTF-8',
    },
  })

  if (!response.ok) {
    throw new LocalizedError(createMessage('errors.apiRequestFailed', { status: response.status }))
  }

  return (await response.json()) as CountResponse
}
