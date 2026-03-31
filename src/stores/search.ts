import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { LocationQuery } from 'vue-router'
import { fetchSearchCount, fetchSearchPage } from '../services/searchApi'
import { adaptSearchResult } from '../services/searchAdapters'
import {
  KeywordResolutionError,
  formatKeywordResolutionError,
  formatKeywordResolutionNotice,
  resolveKeywordCriteria,
  type KeywordResolutionNotice,
} from '../services/keywordResolver'
import { buildSearchRouteQuery, parseSearchRouteQuery } from '../services/searchRoute'
import {
  LIST_FILTER_KEYS,
  type RawItem,
  cloneCriteria,
  createDefaultCriteria,
  getFieldLabel,
  hasActiveCriteria,
  isListAtDefault,
  isListFilterKey,
  normalizeTextList,
  summarizeCriteria,
  type ListFilterKey,
  type RangeFilterKey,
  type SearchCriteriaDraft,
  type SearchResultItem,
  type SearchStatus,
  type SearchTag,
  type ViewMode,
} from '../types/search'
import { LocalizedError, createMessage, currentLocale, resolveMessage, type MessageDescriptor, type MessageLike } from '../i18n'

const PAGE_SIZE = 24
const QUICK_TAG_KEYS: ListFilterKey[] = [...LIST_FILTER_KEYS]

type SearchMessage = MessageLike | KeywordResolutionError | { key: string; params?: Record<string, SearchMessage | number | boolean | null | undefined> }

function resolveSearchMessage(message: SearchMessage): string | null {
  currentLocale.value

  if (message == null) {
    return null
  }

  if (message instanceof KeywordResolutionError) {
    return formatKeywordResolutionError(message)
  }

  if (typeof message === 'string') {
    return message
  }

  if ('key' in message) {
    const resolvedParams = message.params
      ? Object.fromEntries(
          Object.entries(message.params).map(([key, value]) => [
            key,
            value instanceof KeywordResolutionError || (value && typeof value === 'object' && 'key' in value)
              ? resolveSearchMessage(value as SearchMessage) ?? ''
              : value,
          ]),
        )
      : undefined

    return resolveMessage({ key: message.key, params: resolvedParams as Record<string, MessageDescriptor> | undefined })
  }

  return null
}

function isMessageKey(message: SearchMessage, key: string): boolean {
  return Boolean(message && typeof message === 'object' && 'key' in message && message.key === key)
}

function normalizeError(error: unknown): SearchMessage {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return createMessage('errors.requestCancelled')
  }

  if (error instanceof KeywordResolutionError) {
    return error
  }

  if (error instanceof LocalizedError) {
    return error.descriptor
  }

  if (error instanceof Error) {
    return error.message
  }

  return createMessage('errors.requestFailed')
}

export const useSearchStore = defineStore('search', () => {
  const draftCriteria = ref<SearchCriteriaDraft>(createDefaultCriteria())
  const appliedCriteria = ref<SearchCriteriaDraft>(createDefaultCriteria())
  const viewMode = ref<ViewMode>('card')
  const rawResults = ref<RawItem[]>([])
  const status = ref<SearchStatus>('idle')
  const totalCount = ref(0)
  const nextOffset = ref(0)
  const more = ref(false)
  const errorState = ref<SearchMessage>(null)
  const noticeState = ref<KeywordResolutionNotice | null>(null)
  const activeRequestId = ref(0)
  const hasBootstrapped = ref(false)
  const activeController = shallowRef<AbortController | null>(null)
  const effectiveCriteria = ref<SearchCriteriaDraft>(createDefaultCriteria())

  const hasPendingChanges = computed(
    () => JSON.stringify(buildSearchRouteQuery(draftCriteria.value, viewMode.value)) !== JSON.stringify(buildSearchRouteQuery(appliedCriteria.value, viewMode.value)),
  )
  const isInitialLoading = computed(() => status.value === 'loading' && results.value.length === 0)
  const isRefreshing = computed(() => status.value === 'loading' && results.value.length > 0)
  const isLoadingMore = computed(() => status.value === 'loadingMore')
  const routeQuery = computed(() => buildSearchRouteQuery(appliedCriteria.value, viewMode.value))
  const errorMessage = computed(() => resolveSearchMessage(errorState.value))
  const noticeMessage = computed(() => {
    currentLocale.value
    return noticeState.value ? formatKeywordResolutionNotice(noticeState.value) : null
  })
  const appliedSummary = computed(() => {
    currentLocale.value
    return summarizeCriteria(appliedCriteria.value)
  })
  const results = computed<SearchResultItem[]>(() => {
    currentLocale.value
    return rawResults.value.map(adaptSearchResult)
  })
  const quickTags = computed<SearchTag[]>(() => {
    currentLocale.value
    return QUICK_TAG_KEYS.flatMap((key) =>
      isListAtDefault(key, draftCriteria.value[key])
        ? []
        : draftCriteria.value[key].map((value) => ({
            field: key,
            label: getFieldLabel(key),
            value,
            filterable: true,
          })),
    )
  })

  function resetResults(): void {
    status.value = 'idle'
    totalCount.value = 0
    nextOffset.value = 0
    more.value = false
    rawResults.value = []
    errorState.value = null
    noticeState.value = null
    effectiveCriteria.value = createDefaultCriteria()
  }

  function cancelActiveRequest(): void {
    activeController.value?.abort()
    activeController.value = null
  }

  function updateKeyword(value: string): void {
    draftCriteria.value.keyword = value
  }

  function updateRangeFilter(key: RangeFilterKey, value: [number, number]): void {
    draftCriteria.value[key] = [...value] as [number, number]
  }

  function updateListFilter(key: ListFilterKey, value: string[]): void {
    draftCriteria.value[key] = normalizeTextList(value)
  }

  function setViewMode(mode: ViewMode): void {
    viewMode.value = mode
  }

  function addTagToDraft(field: string, value: string, replace = false): boolean {
    if (!isListFilterKey(field)) {
      return false
    }

    draftCriteria.value[field] = replace
      ? [value]
      : normalizeTextList([...draftCriteria.value[field], value])

    return true
  }

  function setTagAsOnlyDraftFilter(field: string, value: string): boolean {
    if (!isListFilterKey(field)) {
      return false
    }

    const nextCriteria = createDefaultCriteria()
    nextCriteria[field] = [value]
    draftCriteria.value = nextCriteria

    return true
  }

  function removeTagFromDraft(field: string, value: string): boolean {
    if (!isListFilterKey(field)) {
      return false
    }

    draftCriteria.value[field] = draftCriteria.value[field].filter((item) => item !== value)
    return true
  }

  async function runSearch(criteria: SearchCriteriaDraft): Promise<void> {
    const requestId = activeRequestId.value + 1
    activeRequestId.value = requestId
    cancelActiveRequest()

    const controller = new AbortController()
    activeController.value = controller
    const hadResults = results.value.length > 0
    const submittedSignature = JSON.stringify(buildSearchRouteQuery(criteria, viewMode.value))

    status.value = 'loading'
    errorState.value = null
    noticeState.value = null
    nextOffset.value = 0
    more.value = false

    try {
      const resolution = await resolveKeywordCriteria(criteria, controller.signal)
      if (activeRequestId.value !== requestId) {
        return
      }

      effectiveCriteria.value = cloneCriteria(resolution.criteria)
      noticeState.value = resolution.noticeMessage

      const [pageResult, countResult] = await Promise.allSettled([
        fetchSearchPage(resolution.criteria, { limit: PAGE_SIZE, offset: 0, signal: controller.signal }),
        fetchSearchCount(resolution.criteria, { signal: controller.signal }),
      ])
      if (activeRequestId.value !== requestId) {
        return
      }

      if (pageResult.status === 'rejected') {
        throw pageResult.reason
      }

      const response = pageResult.value
      const resolvedTotalCount = countResult.status === 'fulfilled' ? countResult.value.count : response.results.length

      appliedCriteria.value = cloneCriteria(resolution.criteria)
      if (JSON.stringify(buildSearchRouteQuery(draftCriteria.value, viewMode.value)) === submittedSignature) {
        draftCriteria.value = cloneCriteria(resolution.criteria)
      }

      rawResults.value = response.results
      totalCount.value = resolvedTotalCount
      nextOffset.value = response.results.length
      more.value = response.more
      status.value = response.results.length > 0 ? 'success' : 'empty'
      errorState.value = null
    } catch (error) {
      if (activeRequestId.value !== requestId) {
        return
      }

      const message = normalizeError(error)
      if (hadResults) {
        status.value = 'success'
        errorState.value = { key: 'errors.refreshFailed', params: { message } }
      } else if (isMessageKey(message, 'errors.requestCancelled')) {
        status.value = 'idle'
        errorState.value = null
      } else {
        status.value = 'error'
        rawResults.value = []
        totalCount.value = 0
        errorState.value = message
        noticeState.value = null
      }
    } finally {
      if (activeRequestId.value === requestId) {
        activeController.value = null
      }
    }
  }

  async function loadMore(): Promise<void> {
    if (!more.value || status.value === 'loadingMore' || status.value === 'loading' || !hasActiveCriteria(effectiveCriteria.value)) {
      return
    }

    const requestId = activeRequestId.value + 1
    activeRequestId.value = requestId
    cancelActiveRequest()

    const controller = new AbortController()
    activeController.value = controller
    status.value = 'loadingMore'
    errorState.value = null

    try {
      const response = await fetchSearchPage(effectiveCriteria.value, {
        limit: PAGE_SIZE,
        offset: nextOffset.value,
        signal: controller.signal,
      })
      if (activeRequestId.value !== requestId) {
        return
      }

      rawResults.value = [...rawResults.value, ...response.results]
      nextOffset.value += response.results.length
      more.value = response.more
      status.value = results.value.length > 0 ? 'success' : 'empty'
    } catch (error) {
      if (activeRequestId.value !== requestId) {
        return
      }

      const message = normalizeError(error)
      status.value = results.value.length > 0 ? 'success' : 'error'
      errorState.value = isMessageKey(message, 'errors.requestCancelled') ? null : { key: 'errors.loadMoreFailed', params: { message } }
    } finally {
      if (activeRequestId.value === requestId) {
        activeController.value = null
      }
    }
  }

  async function applyDraft(): Promise<void> {
    appliedCriteria.value = cloneCriteria(draftCriteria.value)

    if (!hasActiveCriteria(appliedCriteria.value)) {
      cancelActiveRequest()
      resetResults()
      return
    }

    await runSearch(appliedCriteria.value)
  }

  async function clearAll(): Promise<void> {
    cancelActiveRequest()
    draftCriteria.value = createDefaultCriteria()
    appliedCriteria.value = createDefaultCriteria()
    resetResults()
  }

  async function initializeFromRoute(query: LocationQuery, options: { runSearch?: boolean } = {}): Promise<void> {
    const parsed = parseSearchRouteQuery(query)
    const shouldRunSearch = options.runSearch ?? true

    cancelActiveRequest()
    draftCriteria.value = cloneCriteria(parsed.criteria)
    appliedCriteria.value = cloneCriteria(parsed.criteria)
    viewMode.value = parsed.viewMode
    hasBootstrapped.value = true

    if (shouldRunSearch && hasActiveCriteria(parsed.criteria)) {
      await runSearch(parsed.criteria)
      return
    }

    resetResults()
  }

  return {
    draftCriteria,
    appliedCriteria,
    viewMode,
    results,
    status,
    totalCount,
    more,
    errorMessage,
    noticeMessage,
    hasBootstrapped,
    hasPendingChanges,
    isInitialLoading,
    isRefreshing,
    isLoadingMore,
    routeQuery,
    appliedSummary,
    quickTags,
    updateKeyword,
    updateRangeFilter,
    updateListFilter,
    setViewMode,
    addTagToDraft,
    setTagAsOnlyDraftFilter,
    removeTagFromDraft,
    loadMore,
    applyDraft,
    clearAll,
    initializeFromRoute,
  }
})
