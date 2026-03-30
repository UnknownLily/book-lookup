import {
  ITEM_PROP_TYPE,
  isListFilterKey,
  getFieldLabel,
  type DataTypeId,
  type DataValueMap,
  type ItemField,
  type LinkValue,
  type RawItem,
  type SearchDetailSection,
  type SearchResultLink,
  type SearchResultItem,
  type SearchTag,
} from '../types/search'
import { getCurrentIntlLocale as getIntlLocale, t as translate } from '../i18n'

const HIDDEN_FIELDS = new Set<ItemField | string>(['id', 'self', 'name', 'alias', 'searchkey', 'cover', 'cover2x', 'cover3x', 'official', 'website', 'pages'])
const PRIMARY_TAG_FIELDS: ItemField[] = ['circle', 'publisher', 'event', 'type', 'coverchar', 'character', 'rate', 'region']
const DETAIL_FIELD_ORDER: ItemField[] = [
  'circle',
  'publisher',
  'event',
  'eventname',
  'session',
  'type',
  'size',
  'number',
  'pages',
  'commercial',
  'rate',
  'region',
  'establish',
  'year',
  'date',
  'coverchar',
  'covercharnum',
  'character',
  'remark',
]

function normalizeDateTimestamp(value: number): number {
  return value < 1_000_000_000_000 ? value * 1000 : value
}

function formatValue(typeId: DataTypeId, value: DataValueMap[DataTypeId]): string {
  switch (typeId) {
    case '_wpg':
      return (value as DataValueMap['_wpg']).displaytitle || (value as DataValueMap['_wpg']).fulltext
    case '_txt':
      return value as DataValueMap['_txt']
    case '_num':
      return (value as DataValueMap['_num']).toString(10)
    case '_boo':
      return (value as DataValueMap['_boo']) ? translate('filters.options.commercial.商业向') : translate('filters.options.commercial.非商业')
    case '_dat':
      return new Date(normalizeDateTimestamp(value as DataValueMap['_dat'])).toLocaleDateString(getIntlLocale())
    case '_lin': {
      const linkValue = value as DataValueMap['_lin']
      return linkValue.alter?.trim() || linkValue.url
    }
  }
}

interface TagEntry {
  value: string
  displayValue?: string
}

function getValues(item: RawItem, field: ItemField): string[] {
  const rawValues = item[field]
  if (!rawValues || rawValues.length === 0) {
    return []
  }

  const typeId = ITEM_PROP_TYPE[field]
  return rawValues.map((value) => formatValue(typeId, value as never))
}

function getTagEntries(item: RawItem, field: ItemField): TagEntry[] {
  const rawValues = item[field]
  if (!rawValues || rawValues.length === 0) {
    return []
  }

  const typeId = ITEM_PROP_TYPE[field]
  return rawValues.map((rawValue, index) => {
    if (typeId === '_wpg') {
      const pageValue = rawValue as DataValueMap['_wpg']
      const fallbackDisplay = pageValue.displaytitle || pageValue.fulltext
      const displayValue = field === 'event' ? item.eventname?.[index] || fallbackDisplay : fallbackDisplay
      return displayValue === pageValue.fulltext
        ? { value: pageValue.fulltext }
        : { value: pageValue.fulltext, displayValue }
    }

    const value = formatValue(typeId, rawValue as never)
    return { value }
  })
}

function buildTags(item: RawItem, field: ItemField): SearchTag[] {
  return getTagEntries(item, field).map(({ value, displayValue }) => ({
    field,
    label: getFieldLabel(field),
    value,
    displayValue,
    filterable: isListFilterKey(field),
  }))
}

function buildDetailSections(item: RawItem): SearchDetailSection[] {
  return DETAIL_FIELD_ORDER
    .filter((field) => field !== 'eventname' || !item.event?.length)
    .map((field) => ({
    key: field,
    label: getFieldLabel(field),
    tags: buildTags(item, field),
    }))
    .filter((section) => section.tags.length > 0)
}

function buildPrimaryTags(item: RawItem): SearchTag[] {
  return PRIMARY_TAG_FIELDS.flatMap((field) => buildTags(item, field)).slice(0, 12)
}

function buildLinks(item: RawItem): SearchResultLink[] {
  const links: SearchResultLink[] = []

  for (const field of ['official', 'website'] as const) {
    const rawValues = item[field]
    if (!rawValues || rawValues.length === 0) {
      continue
    }

    for (const rawValue of rawValues) {
      const linkValue = typeof rawValue === 'string' ? { url: rawValue, alter: '' } : (rawValue as LinkValue)
      links.push({
        key: `${field}-${linkValue.url}`,
        label: linkValue.alter?.trim() || getFieldLabel(field),
        url: linkValue.url,
      })
    }
  }

  return links
}

export function adaptSearchResult(item: RawItem): SearchResultItem {
  const title = item.name?.[0] ?? (item.self.displaytitle || item.self.fulltext)
  const circles = getValues(item, 'circle')
  const publishers = getValues(item, 'publisher')
  const subtitle = circles.join(' / ') || publishers.join(' / ') || translate('searchResult.subtitleFallback')
  const secondaryNames = getValues(item, 'alias').filter((value) => value !== title)
  const coverUrl = item.cover3x?.[0]?.fullurl ?? item.cover2x?.[0]?.fullurl ?? item.cover?.[0]?.fullurl ?? null
  const eventLabel = getValues(item, 'eventname')[0] || getValues(item, 'event')[0]
  const meta = [
    item.year?.[0] ? translate('searchResult.metaYear', { value: item.year[0] }) : null,
    item.date?.[0] ? translate('searchResult.metaDate', { value: formatValue('_dat', item.date[0]) }) : null,
    eventLabel ? translate('searchResult.metaEvent', { value: eventLabel }) : null,
    getValues(item, 'rate')[0] ? translate('searchResult.metaRate', { value: getValues(item, 'rate')[0] }) : null,
    item.commercial?.[0] !== undefined
        ? translate('searchResult.metaCommercial', { value: formatValue('_boo', item.commercial[0]) })
      : null,
  ].filter((value): value is string => Boolean(value))

  return {
    id: item.id,
    title,
    subtitle,
    secondaryNames,
    wikiUrl: item.self.fullurl,
    coverUrl,
    meta,
    primaryTags: buildPrimaryTags(item),
    detailSections: buildDetailSections(item).filter((section) => !HIDDEN_FIELDS.has(section.key)),
    links: buildLinks(item),
  }
}
