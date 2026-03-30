import type { SearchResultItem, SearchStatus } from '../types/search'
import { getCurrentHtmlLang, getCurrentOgLocale, t } from '../i18n'

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://book.lilywhite.cc').replace(/\/+$/, '')
const OG_IMAGE_PATH = '/og-image.svg'
const OG_IMAGE_WIDTH = '1200'
const OG_IMAGE_HEIGHT = '630'

export interface SearchPageSeoInput {
  hasActiveSearch: boolean
  summary: string[]
  totalCount: number
  status: SearchStatus
  results: SearchResultItem[]
  locale: string
}

function toPageUrl(pathWithSearch: string): string {
  if (!SITE_URL) {
    return pathWithSearch
  }

  return new URL(pathWithSearch, `${SITE_URL}/`).toString()
}

function getCanonicalUrl(): string {
  return toPageUrl('/')
}

function getOgImageUrl(): string {
  return toPageUrl(OG_IMAGE_PATH)
}

function getCurrentUrl(input: SearchPageSeoInput): string {
  if (typeof window === 'undefined') {
    return input.hasActiveSearch ? toPageUrl('/') : getCanonicalUrl()
  }

  const url = new URL(window.location.href)
  url.hash = ''
  const pathWithSearch = `${url.pathname}${url.search}` || '/'
  return toPageUrl(pathWithSearch)
}

function buildTitle(input: SearchPageSeoInput): string {
  const siteName = t('app.title')
  if (!input.hasActiveSearch) {
    return `${siteName} | ${t('seo.defaultTitle')}`
  }

  const summaryText = input.summary.slice(0, 2).join('，') || t('seo.summaryFallback')

  if (input.status === 'error') {
    return t('seo.titleError', { summary: summaryText, siteName })
  }

  if (input.status === 'empty') {
    return t('seo.titleEmpty', { summary: summaryText, siteName })
  }

  if (input.totalCount > 0) {
    return t('seo.titleCount', { summary: summaryText, count: input.totalCount, siteName })
  }

  return t('seo.titleLoading', { summary: summaryText, siteName })
}

function buildDescription(input: SearchPageSeoInput): string {
  const defaultDescription = t('seo.description')
  if (!input.hasActiveSearch) {
    return defaultDescription
  }

  const summaryText = input.summary.slice(0, 4).join('；')
  const resultText = input.status === 'empty'
    ? t('seo.resultEmpty')
    : input.totalCount > 0
      ? t('seo.resultCount', { count: input.totalCount })
      : input.status === 'error'
        ? t('seo.resultError')
        : t('seo.resultLoading')

  return `${summaryText ? t('seo.currentFilters', { summary: summaryText }) : ''}${resultText} ${t('seo.descriptionSuffix')}`
}

function buildStructuredData(input: SearchPageSeoInput, title: string, description: string, canonicalUrl: string, currentUrl: string): Array<Record<string, unknown>> {
  const website: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: t('app.title'),
    alternateName: t('app.altName'),
    url: canonicalUrl,
    description: t('seo.description'),
    inLanguage: getCurrentHtmlLang(),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${canonicalUrl}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  const webPage: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': input.hasActiveSearch ? 'SearchResultsPage' : 'WebPage',
    name: title,
    url: input.hasActiveSearch ? currentUrl : canonicalUrl,
    description,
    inLanguage: getCurrentHtmlLang(),
    isPartOf: {
      '@type': 'WebSite',
      name: t('app.title'),
      url: canonicalUrl,
    },
  }

  if (input.results.length > 0) {
    webPage.mainEntity = {
      '@type': 'ItemList',
      itemListElement: input.results.slice(0, 10).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
        url: item.wikiUrl,
      })),
    }
  }

  return [website, webPage]
}

export function createSearchPageHead(input: SearchPageSeoInput) {
  const canonicalUrl = getCanonicalUrl()
  const currentUrl = getCurrentUrl(input)
  const ogImageUrl = getOgImageUrl()
  const title = buildTitle(input)
  const description = buildDescription(input)
  const ogImageAlt = t('seo.ogImageAlt')
  const robots = input.hasActiveSearch
    ? 'noindex,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1'
    : 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1'
  const structuredData = JSON.stringify(buildStructuredData(input, title, description, canonicalUrl, currentUrl))

  return {
    htmlAttrs: {
      lang: getCurrentHtmlLang(),
    },
    title,
    link: [
      {
        key: 'canonical',
        rel: 'canonical',
        href: canonicalUrl,
      },
    ],
    meta: [
      {
        key: 'description',
        name: 'description',
        content: description,
      },
      {
        key: 'keywords',
        name: 'keywords',
        content: t('seo.keywords'),
      },
      {
        key: 'robots',
        name: 'robots',
        content: robots,
      },
      {
        key: 'twitter:card',
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        key: 'twitter:title',
        name: 'twitter:title',
        content: title,
      },
      {
        key: 'twitter:description',
        name: 'twitter:description',
        content: description,
      },
      {
        key: 'twitter:image',
        name: 'twitter:image',
        content: ogImageUrl,
      },
      {
        key: 'twitter:image:alt',
        name: 'twitter:image:alt',
        content: ogImageAlt,
      },
      {
        key: 'og:locale',
        property: 'og:locale',
        content: getCurrentOgLocale(),
      },
      {
        key: 'og:type',
        property: 'og:type',
        content: 'website',
      },
      {
        key: 'og:site_name',
        property: 'og:site_name',
        content: t('app.title'),
      },
      {
        key: 'og:title',
        property: 'og:title',
        content: title,
      },
      {
        key: 'og:description',
        property: 'og:description',
        content: description,
      },
      {
        key: 'og:url',
        property: 'og:url',
        content: currentUrl,
      },
      {
        key: 'og:image',
        property: 'og:image',
        content: ogImageUrl,
      },
      {
        key: 'og:image:width',
        property: 'og:image:width',
        content: OG_IMAGE_WIDTH,
      },
      {
        key: 'og:image:height',
        property: 'og:image:height',
        content: OG_IMAGE_HEIGHT,
      },
      {
        key: 'og:image:alt',
        property: 'og:image:alt',
        content: ogImageAlt,
      },
    ],
    script: [
      {
        key: 'search-page-structured-data',
        type: 'application/ld+json',
        innerHTML: structuredData,
      },
    ],
  }
}
