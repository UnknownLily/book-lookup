<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import SearchFiltersPanel from '../components/search/SearchFiltersPanel.vue'
import SearchResults from '../components/search/SearchResults.vue'
import SearchTopBar from '../components/search/SearchTopBar.vue'
import { createSearchPageHead } from '../services/seo'
import { routeQuerySignature } from '../services/searchRoute'
import { useSearchStore } from '../stores/search'
import type { SearchTag, ViewMode } from '../types/search'

const store = useSearchStore()
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const mobileFiltersOpen = ref(false)
const hasActiveSearch = computed(() => Object.keys(route.query).some((key) => key !== 'view'))

const statusBanner = computed(() => {
  if (store.isRefreshing) {
    return {
      tone: 'primary' as const,
      icon: '$searchScan',
      text: t('status.refreshingDetail'),
    }
  }

  if (store.errorMessage) {
    return {
      tone: 'error' as const,
      icon: '$alertCircleOutline',
      text: store.errorMessage,
    }
  }

  if (store.noticeMessage) {
    return {
      tone: 'secondary' as const,
      icon: '$applyFilter',
      text: store.noticeMessage,
    }
  }

  return null
})

async function syncUrl(): Promise<void> {
  await router.replace({ query: store.routeQuery })
}

async function applyFilters(): Promise<void> {
  await store.applyDraft()
  mobileFiltersOpen.value = false
  await syncUrl()
}

async function clearFilters(): Promise<void> {
  await store.clearAll()
  mobileFiltersOpen.value = false
  await syncUrl()
}

async function updateViewMode(mode: ViewMode): Promise<void> {
  store.setViewMode(mode)
  await syncUrl()
}

function handleTagAdd(tag: SearchTag): void {
  store.addTagToDraft(tag.field, tag.value, false)
}

function handleTagSet(tag: SearchTag): void {
  store.addTagToDraft(tag.field, tag.value, true)
}

function handleQuickTagAdd(tag: SearchTag): void {
  store.addTagToDraft(tag.field, tag.value, false)
  store.updateKeyword('')
}

function handleQuickTagRemove(tag: SearchTag): void {
  store.removeTagFromDraft(tag.field, tag.value)
}

function handleRangeUpdate(key: Parameters<typeof store.updateRangeFilter>[0], value: Parameters<typeof store.updateRangeFilter>[1]): void {
  store.updateRangeFilter(key, value)
}

function handleListUpdate(key: Parameters<typeof store.updateListFilter>[0], value: Parameters<typeof store.updateListFilter>[1]): void {
  store.updateListFilter(key, value)
}

onMounted(async () => {
  if (!store.hasBootstrapped) {
    await store.initializeFromRoute(route.query)
  }
})

watch(
  () => route.query,
  async (query) => {
    if (!store.hasBootstrapped) {
      return
    }

    if (routeQuerySignature(query) !== routeQuerySignature(store.routeQuery)) {
      await store.initializeFromRoute(query)
    }
  },
  { deep: true },
)

useHead(
  () => createSearchPageHead({
    hasActiveSearch: hasActiveSearch.value,
    summary: store.appliedSummary,
    totalCount: store.totalCount,
    status: store.status,
    results: store.results,
    locale: locale.value,
  }),
)
</script>

<template>
  <v-app>
    <v-main class="page-main">
      <div class="page-shell">
        <SearchTopBar
          :keyword="store.draftCriteria.keyword"
          :quick-tags="store.quickTags"
          :summary="store.appliedSummary"
          :total-count="store.totalCount"
          :can-search="store.canSearch"
          :has-pending-changes="store.hasPendingChanges"
          :is-loading="store.status === 'loading'"
          :is-refreshing="store.isRefreshing"
          @update-keyword="store.updateKeyword"
          @apply="applyFilters"
          @clear="clearFilters"
          @open-filters="mobileFiltersOpen = true"
          @add-quick-tag="handleQuickTagAdd"
          @remove-quick-tag="handleQuickTagRemove"
        />

        <v-alert
          v-if="statusBanner"
          :icon="statusBanner.icon"
          variant="flat"
          rounded="xl"
          :class="['status-banner', `status-banner--${statusBanner.tone}`]"
        >
          {{ statusBanner.text }}
        </v-alert>

        <div class="page-layout">
          <aside class="sidebar desktop-only">
            <div class="sidebar-scroll">
              <SearchFiltersPanel
                :draft-criteria="store.draftCriteria"
                @update-range="handleRangeUpdate"
                @update-list="handleListUpdate"
              />
            </div>
          </aside>

          <section class="content-column">
            <SearchResults
              :results="store.results"
              :view-mode="store.viewMode"
              :status="store.status"
              :total-count="store.totalCount"
              :more="store.more"
              :is-loading-more="store.isLoadingMore"
              :is-initial-loading="store.isInitialLoading"
              @load-more="store.loadMore"
              @add-tag="handleTagAdd"
              @set-tag="handleTagSet"
              @update-view-mode="updateViewMode"
            />
          </section>
        </div>
      </div>

      <v-navigation-drawer v-model="mobileFiltersOpen" temporary location="left" width="360" class="mobile-only mobile-filters-drawer">
        <div class="drawer-inner">
          <div class="drawer-content">
            <SearchFiltersPanel
              :draft-criteria="store.draftCriteria"
              @update-range="handleRangeUpdate"
              @update-list="handleListUpdate"
            />
          </div>
          <div class="drawer-actions">
            <v-btn class="drawer-action-btn" variant="text" @click="mobileFiltersOpen = false">{{ t('actions.close') }}</v-btn>
            <v-btn class="drawer-action-btn" color="primary" :loading="store.status === 'loading'" @click="applyFilters">{{ t('actions.applyFilters') }}</v-btn>
          </div>
        </div>
      </v-navigation-drawer>
    </v-main>
  </v-app>
</template>

<style scoped>
.page-main {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(var(--v-theme-primary), 0.1), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0));
}

.page-shell {
  max-width: 1480px;
  margin: 0 auto;
  padding: 28px;
  display: grid;
  gap: 20px;
}

.status-banner {
  --status-banner-rgb: var(--v-theme-primary);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(var(--status-banner-rgb), 0.16);
  border-inline-start-width: 5px;
  border-inline-start-color: rgba(var(--status-banner-rgb), 0.38);
  background: rgba(var(--status-banner-rgb), 0.1) !important;
  color: rgb(var(--status-banner-rgb)) !important;
  box-shadow: 0 10px 24px rgba(var(--status-banner-rgb), 0.04);
}

.status-banner--primary {
  --status-banner-rgb: var(--v-theme-primary);
}

.status-banner--secondary {
  --status-banner-rgb: var(--v-theme-secondary);
}

.status-banner--error {
  --status-banner-rgb: var(--v-theme-primary);
}

.status-banner :deep(.v-alert__prepend .v-icon) {
  color: rgb(var(--status-banner-rgb));
}

.status-banner :deep(.v-alert__prepend) {
  margin-inline-end: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.status-banner :deep(.v-alert__content) {
  color: rgb(var(--status-banner-rgb));
  font-weight: 600;
}

.page-layout {
  display: grid;
  grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  min-height: 0;
}

.sidebar {
  position: sticky;
  top: 24px;
  align-self: start;
  min-height: 0;
}

.sidebar-scroll {
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  overscroll-behavior: contain;
  box-sizing: border-box;
  padding: 0 18px 24px 16px;
  scrollbar-gutter: stable;
}

.content-column {
  min-width: 0;
}

.sidebar-scroll::-webkit-scrollbar {
  width: 10px;
}

.sidebar-scroll::-webkit-scrollbar-track {
  background: rgba(var(--v-theme-primary), 0.08);
  border-radius: 999px;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-primary), 0.28);
  border-radius: 999px;
}

.sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-primary), 0.4);
}

.drawer-inner {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  height: 100%;
  gap: 16px;
  padding: 18px 14px 18px;
}

.drawer-content {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-inline-end: 4px;
}

.drawer-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  position: sticky;
  bottom: 0;
  padding-top: 12px;
  background: linear-gradient(180deg, rgba(255, 248, 251, 0), rgba(255, 248, 251, 0.9) 24%, rgba(255, 248, 251, 0.98));
}

.drawer-action-btn {
  border-radius: var(--search-control-radius);
}

.drawer-action-btn :deep(.v-btn__overlay),
.drawer-action-btn :deep(.v-btn__underlay) {
  border-radius: inherit;
}

.mobile-filters-drawer :deep(.v-navigation-drawer__content) {
  border-top-right-radius: 28px;
  border-bottom-right-radius: 28px;
}

.mobile-filters-drawer {
  width: min(360px, calc(100vw - 12px)) !important;
  max-width: calc(100vw - 12px) !important;
}

.mobile-only {
  display: none;
}

@media (max-width: 960px) {
  .page-shell {
    padding: 16px;
    gap: 16px;
  }

  .status-banner {
    backdrop-filter: none;
    box-shadow: 0 6px 14px rgba(var(--status-banner-rgb), 0.05);
  }

  .drawer-inner {
    gap: 12px;
    padding: 12px 12px 14px;
  }

  .page-layout {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .desktop-only {
    display: none;
  }

  .sidebar {
    min-height: auto;
  }

  .sidebar-scroll {
    max-height: none;
    overflow: visible;
    padding: 0;
  }

  .mobile-only {
    display: block;
  }
}

@media (max-width: 720px) {
  .page-main {
    background: rgba(250, 243, 246, 0.92);
  }

  .page-shell {
    padding: 12px;
  }

  .status-banner {
    border-inline-start-width: 4px;
    box-shadow: none;
    background: rgba(var(--status-banner-rgb), 0.08) !important;
  }

  .drawer-actions {
    flex-direction: column-reverse;
  }

  .drawer-action-btn {
    width: 100%;
    min-height: 48px;
  }
}
</style>
