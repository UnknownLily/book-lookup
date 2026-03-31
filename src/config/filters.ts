import type { FilterKey, ListFilterKey, RangeFilterKey } from '../types/search'

export interface RangeFilterDefinition {
  key: RangeFilterKey
  type: 'range'
  min: number
  max: number
  formatter?: (value: number) => string
}

export interface ListFilterDefinition {
  key: ListFilterKey
  type: 'checklist' | 'taglist'
  items: string[]
  hintKey?: string
  suggestionSource?: string
}

export type FilterDefinition = RangeFilterDefinition | ListFilterDefinition

export interface FilterGroup {
  id: string
  titleKey: string
  descriptionKey: string
  filters: FilterDefinition[]
}

function formatDuration(value: number): string {
  return value.toString()
}

export const BOOK_TYPE_OPTIONS = [
  '漫画',
  '画集',
  '设定集',
  '评论志',
  '绘本',
  '小说',
  '歌词本',
  '合同志',
  '摄影集',
  '总集',
  '其他',
  '乐谱',
  '场刊',
  '诗集',
  '剧本',
] as const

export const FILTER_GROUPS: FilterGroup[] = [
  {
    id: 'timeline',
    titleKey: 'filters.groups.timeline.title',
    descriptionKey: 'filters.groups.timeline.description',
    filters: [
      { key: 'establish', type: 'range', min: 1990, max: 2035 },
      { key: 'year', type: 'range', min: 1990, max: 2035 },
      { key: 'pages', type: 'range', min: 0, max: 500, formatter: formatDuration },
      { key: 'covercharnum', type: 'range', min: 0, max: 20 },
    ],
  },
  {
    id: 'publishing',
    titleKey: 'filters.groups.publishing.title',
    descriptionKey: 'filters.groups.publishing.description',
    filters: [
      { key: 'circle', type: 'taglist', items: [], hintKey: 'filters.hints.circle', suggestionSource: '制作方建议' },
      { key: 'publisher', type: 'taglist', items: [], hintKey: 'filters.hints.publisher' },
      { key: 'event', type: 'taglist', items: [], hintKey: 'filters.hints.event', suggestionSource: '发售展会建议' },
      { key: 'eventname', type: 'taglist', items: [], hintKey: 'filters.hints.eventname' },
      { key: 'session', type: 'taglist', items: [], hintKey: 'filters.hints.session' },
      { key: 'commercial', type: 'checklist', items: ['商业向', '非商业'] },
    ],
  },
  {
    id: 'bibliography',
    titleKey: 'filters.groups.bibliography.title',
    descriptionKey: 'filters.groups.bibliography.description',
    filters: [
      { key: 'type', type: 'checklist', items: [...BOOK_TYPE_OPTIONS] },
      { key: 'size', type: 'taglist', items: [], hintKey: 'filters.hints.size' },
      { key: 'number', type: 'taglist', items: [], hintKey: 'filters.hints.number' },
      { key: 'rate', type: 'checklist', items: ['一般向', 'R15', 'R18'] },
      { key: 'region', type: 'checklist', items: ['日本', '中国大陆', '台湾', '香港', '韩国', '美国', '英国', '德国', '加拿大'] },
    ],
  },
  {
    id: 'characters',
    titleKey: 'filters.groups.characters.title',
    descriptionKey: 'filters.groups.characters.description',
    filters: [
      { key: 'coverchar', type: 'taglist', items: [], hintKey: 'filters.hints.coverchar', suggestionSource: '封面角色建议' },
      { key: 'character', type: 'taglist', items: [], hintKey: 'filters.hints.character' },
    ],
  },
]

export function isRangeFilter(filter: FilterDefinition): filter is RangeFilterDefinition {
  return filter.type === 'range'
}

export function isListFilter(filter: FilterDefinition): filter is ListFilterDefinition {
  return filter.type === 'checklist' || filter.type === 'taglist'
}

export function findFilterDefinition(key: FilterKey): FilterDefinition | undefined {
  for (const group of FILTER_GROUPS) {
    const filter = group.filters.find((item) => item.key === key)
    if (filter) {
      return filter
    }
  }

  return undefined
}
