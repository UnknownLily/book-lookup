export type ViewMode = 'card' | 'list'

import { t } from '../i18n'

export const RANGE_FILTER_KEYS = ['establish', 'year', 'pages', 'covercharnum'] as const
export const LIST_FILTER_KEYS = [
  'circle',
  'publisher',
  'event',
  'eventname',
  'session',
  'commercial',
  'type',
  'size',
  'number',
  'rate',
  'region',
  'coverchar',
  'character',
] as const

export type RangeFilterKey = (typeof RANGE_FILTER_KEYS)[number]
export type ListFilterKey = (typeof LIST_FILTER_KEYS)[number]
export type FilterKey = RangeFilterKey | ListFilterKey

export interface SearchCriteriaDraft {
  keyword: string
  establish: [number, number]
  year: [number, number]
  pages: [number, number]
  covercharnum: [number, number]
  circle: string[]
  publisher: string[]
  event: string[]
  eventname: string[]
  session: string[]
  commercial: string[]
  type: string[]
  size: string[]
  number: string[]
  rate: string[]
  region: string[]
  coverchar: string[]
  character: string[]
}

export interface SearchTag {
  field: string
  label: string
  value: string
  displayValue?: string
  filterable: boolean
}

export interface SearchDetailSection {
  key: string
  label: string
  tags: SearchTag[]
}

export interface SearchResultLink {
  key: string
  label: string
  url: string
}

export interface SearchResultItem {
  id: string
  title: string
  subtitle: string
  secondaryNames: string[]
  wikiUrl: string
  coverUrl: string | null
  meta: string[]
  primaryTags: SearchTag[]
  detailSections: SearchDetailSection[]
  links: SearchResultLink[]
}

export type SearchStatus = 'idle' | 'loading' | 'loadingMore' | 'success' | 'empty' | 'error'

export type DataTypeId = '_wpg' | '_txt' | '_num' | '_boo' | '_dat' | '_lin'

export interface WpgValue {
  fulltext: string
  fullurl: string
  namespace: number
  exists: boolean
  displaytitle: string
}

export interface LinkValue {
  url: string
  alter?: string
}

export interface DataValueMap {
  _wpg: WpgValue
  _txt: string
  _num: number
  _boo: boolean
  _dat: number
  _lin: LinkValue
}

export const ITEM_PROP_TYPE = {
  self: '_wpg',
  searchkey: '_txt',
  name: '_txt',
  alias: '_txt',
  type: '_txt',
  character: '_wpg',
  size: '_txt',
  commercial: '_boo',
  pages: '_num',
  number: '_txt',
  circle: '_wpg',
  publisher: '_wpg',
  event: '_wpg',
  eventname: '_txt',
  date: '_dat',
  year: '_num',
  rate: '_txt',
  official: '_lin',
  remark: '_txt',
  coverchar: '_wpg',
  covercharnum: '_num',
  cover: '_wpg',
  cover2x: '_wpg',
  cover3x: '_wpg',
  region: '_txt',
  establish: '_num',
  session: '_txt',
  website: '_txt',
} as const

export type ItemField = keyof typeof ITEM_PROP_TYPE

export type RawItem = {
  id: string
  self: WpgValue
} & {
  [K in ItemField]?: Array<DataValueMap[(typeof ITEM_PROP_TYPE)[K]]>
}

export interface QueryResponse {
  count: number
  hash: string
  more: boolean
  offset: number
  prints: string[]
  query: string
  results: RawItem[]
  serializer: string
  time: number
  version: number
}

export interface CountResponse {
  count: number
  hash: string
  query: string
  time: number
}

export type ApiCriteriaPayload = Partial<Record<ItemField, string[] | null>>

const DEFAULT_RATE_VALUES = ['一般向'] as const

export const RANGE_BOUNDS: Record<RangeFilterKey, { min: number; max: number }> = {
  establish: { min: 1990, max: 2035 },
  year: { min: 1990, max: 2035 },
  pages: { min: 0, max: 500 },
  covercharnum: { min: 0, max: 20 },
}

const FIELD_LABEL_KEYS: Record<string, string> = {
  establish: 'fields.establish',
  year: 'fields.year',
  pages: 'fields.pages',
  covercharnum: 'fields.covercharnum',
  circle: 'fields.circle',
  publisher: 'fields.publisher',
  event: 'fields.event',
  eventname: 'fields.eventname',
  session: 'fields.session',
  commercial: 'fields.commercial',
  type: 'fields.type',
  size: 'fields.size',
  number: 'fields.number',
  rate: 'fields.rate',
  region: 'fields.region',
  coverchar: 'fields.coverchar',
  character: 'fields.character',
  date: 'fields.date',
  official: 'fields.official',
  website: 'fields.website',
  remark: 'fields.remark',
  cover: 'fields.cover',
  cover2x: 'fields.cover',
  cover3x: 'fields.cover',
  alias: 'fields.alias',
  searchkey: 'fields.searchkey',
}

const FILTER_VALUE_LABEL_KEYS: Partial<Record<ListFilterKey, Record<string, string>>> = {
  commercial: {
    商业向: 'filters.options.commercial.商业向',
    非商业: 'filters.options.commercial.非商业',
  },
  type: {
    漫画: 'filters.options.type.漫画',
    画集: 'filters.options.type.画集',
    设定集: 'filters.options.type.设定集',
    评论志: 'filters.options.type.评论志',
    绘本: 'filters.options.type.绘本',
    小说: 'filters.options.type.小说',
    歌词本: 'filters.options.type.歌词本',
    合同志: 'filters.options.type.合同志',
    摄影集: 'filters.options.type.摄影集',
    总集: 'filters.options.type.总集',
    其他: 'filters.options.type.其他',
    乐谱: 'filters.options.type.乐谱',
    场刊: 'filters.options.type.场刊',
    诗集: 'filters.options.type.诗集',
    剧本: 'filters.options.type.剧本',
  },
  rate: {
    一般向: 'filters.options.rate.一般向',
    R15: 'filters.options.rate.R15',
    R18: 'filters.options.rate.R18',
  },
  region: {
    日本: 'filters.options.region.日本',
    中国大陆: 'filters.options.region.中国大陆',
    台湾: 'filters.options.region.台湾',
    香港: 'filters.options.region.香港',
    韩国: 'filters.options.region.韩国',
    美国: 'filters.options.region.美国',
    英国: 'filters.options.region.英国',
    德国: 'filters.options.region.德国',
    加拿大: 'filters.options.region.加拿大',
  },
}

export function getFieldLabel(field: string): string {
  const key = FIELD_LABEL_KEYS[field]
  return key ? t(key) : field
}

export function getFilterValueLabel(field: string, value: string): string {
  if (!isListFilterKey(field)) {
    return value
  }

  const key = FILTER_VALUE_LABEL_KEYS[field]?.[value]
  return key ? t(key) : value
}

export function createDefaultCriteria(): SearchCriteriaDraft {
  return {
    keyword: '',
    establish: [RANGE_BOUNDS.establish.min, RANGE_BOUNDS.establish.max],
    year: [RANGE_BOUNDS.year.min, RANGE_BOUNDS.year.max],
    pages: [RANGE_BOUNDS.pages.min, RANGE_BOUNDS.pages.max],
    covercharnum: [RANGE_BOUNDS.covercharnum.min, RANGE_BOUNDS.covercharnum.max],
    circle: [],
    publisher: [],
    event: [],
    eventname: [],
    session: [],
    commercial: [],
    type: [],
    size: [],
    number: [],
    rate: [...DEFAULT_RATE_VALUES],
    region: [],
    coverchar: [],
    character: [],
  }
}

function listValuesEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function isListAtDefault(key: ListFilterKey, value: string[]): boolean {
  return listValuesEqual(value, createDefaultCriteria()[key])
}

export function cloneCriteria(criteria: SearchCriteriaDraft): SearchCriteriaDraft {
  return {
    keyword: criteria.keyword,
    establish: [...criteria.establish] as [number, number],
    year: [...criteria.year] as [number, number],
    pages: [...criteria.pages] as [number, number],
    covercharnum: [...criteria.covercharnum] as [number, number],
    circle: [...criteria.circle],
    publisher: [...criteria.publisher],
    event: [...criteria.event],
    eventname: [...criteria.eventname],
    session: [...criteria.session],
    commercial: [...criteria.commercial],
    type: [...criteria.type],
    size: [...criteria.size],
    number: [...criteria.number],
    rate: [...criteria.rate],
    region: [...criteria.region],
    coverchar: [...criteria.coverchar],
    character: [...criteria.character],
  }
}

export function isListFilterKey(field: string): field is ListFilterKey {
  return (LIST_FILTER_KEYS as readonly string[]).includes(field)
}

export function normalizeTextList(values: string[]): string[] {
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

export function isRangeAtDefault(key: RangeFilterKey, value: [number, number]): boolean {
  return value[0] === RANGE_BOUNDS[key].min && value[1] === RANGE_BOUNDS[key].max
}

export function hasActiveCriteria(criteria: SearchCriteriaDraft): boolean {
  if (criteria.keyword.trim().length > 0) {
    return true
  }

  if (RANGE_FILTER_KEYS.some((key) => !isRangeAtDefault(key, criteria[key]))) {
    return true
  }

  return LIST_FILTER_KEYS.some((key) => !isListAtDefault(key, criteria[key]))
}

export function summarizeCriteria(criteria: SearchCriteriaDraft): string[] {
  const summary: string[] = []

  if (criteria.keyword.trim()) {
    summary.push(t('summary.keyword', { value: criteria.keyword.trim() }))
  }

  for (const key of RANGE_FILTER_KEYS) {
    if (!isRangeAtDefault(key, criteria[key])) {
      const [start, end] = criteria[key]
      summary.push(t('summary.range', { label: getFieldLabel(key), start, end }))
    }
  }

  for (const key of LIST_FILTER_KEYS) {
    if (!isListAtDefault(key, criteria[key])) {
      const values = criteria[key]
        .slice(0, 2)
        .map((value) => getFilterValueLabel(key, value))
        .join(t('summary.separator'))
      const suffix = criteria[key].length > 2 ? t('summary.listMoreSuffix') : ''
      summary.push(t('summary.list', { label: getFieldLabel(key), value: `${values}${suffix}` }))
    }
  }

  return summary
}
