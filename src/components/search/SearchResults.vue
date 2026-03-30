<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SearchCard from './SearchCard.vue'
import SearchListItem from './SearchListItem.vue'
import type { SearchResultItem, SearchStatus, SearchTag, ViewMode } from '../../types/search'

const props = defineProps<{
  results: SearchResultItem[]
  viewMode: ViewMode
  status: SearchStatus
  totalCount: number
  more: boolean
  isLoadingMore: boolean
  isInitialLoading: boolean
}>()

const { t } = useI18n()

const emit = defineEmits<{
  loadMore: []
  addTag: [tag: SearchTag]
  setTag: [tag: SearchTag]
  updateViewMode: [mode: ViewMode]
}>()

const sentinel = ref<HTMLDivElement | null>(null)
let observer: IntersectionObserver | null = null

function handleViewModeUpdate(mode: ViewMode): void {
  window.dispatchEvent(new Event('search-card-collapse'))
  emit('updateViewMode', mode)
}

function setupObserver(): void {
  observer?.disconnect()
  if (!sentinel.value) {
    return
  }

  observer = new IntersectionObserver((entries) => {
    const first = entries[0]
    if (first?.isIntersecting && props.more && !props.isLoadingMore && props.status !== 'loading') {
      emit('loadMore')
    }
  })

  observer.observe(sentinel.value)
}

onMounted(async () => {
  await nextTick()
  setupObserver()
})

watch([() => props.more, () => props.isLoadingMore, () => props.viewMode, sentinel], async () => {
  await nextTick()
  setupObserver()
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <section class="results-panel">
    <header class="results-head">
      <div class="results-title-block">
        <h2>{{ t('results.panelTitle') }}</h2>
        <p>{{ t('results.panelDescription') }}</p>
      </div>
      <div class="results-toolbar">
        <div class="results-count">{{ totalCount > 0 ? t('status.returnedCount', { shown: results.length, total: totalCount }) : t('status.waitingQuery') }}</div>
        <div class="view-switcher">
          <span class="view-switcher-label">{{ t('results.viewMode') }}</span>
          <v-btn-toggle
            class="view-toggle"
            mandatory
            divided
            :model-value="viewMode"
            @update:model-value="handleViewModeUpdate($event)"
          >
            <v-btn value="card" icon="$viewCard" :aria-label="t('results.viewCard')" />
            <v-btn value="list" icon="$viewList" :aria-label="t('results.viewList')" />
          </v-btn-toggle>
        </div>
      </div>
    </header>

    <div v-if="status === 'idle'" class="results-empty">
      <v-icon icon="$searchScan" size="40" />
      <h3>{{ t('results.idleTitle') }}</h3>
      <p>{{ t('results.idleText') }}</p>
    </div>

    <div v-else-if="status === 'error' && results.length === 0" class="results-empty">
      <v-icon icon="$alertCircleOutline" size="40" />
      <h3>{{ t('results.errorTitle') }}</h3>
      <p>{{ t('results.errorText') }}</p>
    </div>

    <div v-else-if="status === 'empty'" class="results-empty">
      <v-icon icon="$fileSearchOutline" size="40" />
      <h3>{{ t('results.emptyTitle') }}</h3>
      <p>{{ t('results.emptyText') }}</p>
    </div>

    <template v-else>
      <div v-if="isInitialLoading && viewMode === 'card'" class="results-grid">
        <div v-for="index in 8" :key="`card-skeleton-${index}`" class="card-skeleton">
          <div class="skeleton-cover" />
          <div class="skeleton-body">
            <div class="skeleton-line skeleton-line-title" />
            <div class="skeleton-line" />
            <div class="skeleton-line skeleton-line-short" />
            <div class="skeleton-line skeleton-line-medium" />
            <div class="skeleton-actions">
              <div class="skeleton-pill" />
              <div class="skeleton-pill" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="isInitialLoading" class="results-list">
        <div v-for="index in 8" :key="`list-skeleton-${index}`" class="list-skeleton">
          <div class="list-skeleton-cover" />
          <div class="list-skeleton-body">
            <div class="skeleton-line skeleton-line-title" />
            <div class="skeleton-line" />
            <div class="skeleton-line skeleton-line-medium" />
            <div class="skeleton-line skeleton-line-short" />
            <div class="skeleton-tags">
              <div class="skeleton-pill" />
              <div class="skeleton-pill" />
              <div class="skeleton-pill skeleton-pill-short" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="viewMode === 'card'" class="results-grid">
        <SearchCard
          v-for="item in results"
          :key="item.id"
          :item="item"
          @add-tag="emit('addTag', $event)"
          @set-tag="emit('setTag', $event)"
        />
      </div>

      <div v-else class="results-list">
        <SearchListItem
          v-for="item in results"
          :key="item.id"
          :item="item"
          @add-tag="emit('addTag', $event)"
          @set-tag="emit('setTag', $event)"
        />
      </div>

      <div ref="sentinel" class="sentinel" aria-hidden="true" />

      <div v-if="isLoadingMore" class="load-more-state">
        <v-progress-circular color="primary" indeterminate />
        <span>{{ t('status.loadingMore') }}</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.results-panel {
  display: grid;
  gap: 18px;
}

.results-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
}

.results-title-block {
  min-width: 0;
}

.results-head h2 {
  margin: 0;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: 1.45rem;
}

.results-head p {
  margin: 8px 0 0;
  color: rgba(31, 45, 51, 0.62);
}

.results-count {
  color: rgba(31, 45, 51, 0.58);
  font-size: 0.95rem;
}

.results-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: end;
}

.view-switcher {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(var(--v-theme-primary), 0.14);
  background: rgba(255, 250, 244, 0.88);
  box-shadow: 0 10px 24px rgba(92, 52, 68, 0.08);
}

.view-switcher-label {
  color: rgba(31, 45, 51, 0.62);
  font-size: 0.9rem;
  letter-spacing: 0.04em;
}

.view-toggle {
  flex-shrink: 0;
}

.view-toggle :deep(.v-btn-group) {
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-primary), 0.08);
}

.view-toggle :deep(.v-btn) {
  min-width: 44px;
  color: rgba(31, 45, 51, 0.62);
  transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.view-toggle :deep(.v-btn:hover) {
  color: rgba(31, 45, 51, 0.82);
}

.view-toggle :deep(.v-btn--active) {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-primary), 0.18);
}

.view-toggle :deep(.v-btn--active:hover) {
  color: rgb(var(--v-theme-primary));
}

.view-toggle :deep(.v-btn--active .v-icon) {
  transform: scale(1.05);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.results-list {
  display: grid;
  gap: 14px;
}

.results-empty {
  min-height: 320px;
  display: grid;
  place-items: center;
  gap: 12px;
  text-align: center;
  border: 1px dashed var(--theme-border-strong);
  background: rgba(255, 246, 249, 0.72);
  border-radius: 28px;
  padding: 32px;
  color: var(--text-soft);
}

.results-empty h3 {
  margin: 0;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
}

.results-empty p {
  max-width: 560px;
  margin: 0;
}

.card-skeleton,
.list-skeleton {
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid var(--theme-border-soft);
  background: var(--surface-panel-muted);
  box-shadow: var(--shadow-soft);
}

.card-skeleton {
  display: grid;
}

.list-skeleton {
  display: grid;
  grid-template-columns: 188px minmax(0, 1fr);
}

.skeleton-cover,
.list-skeleton-cover,
.skeleton-line,
.skeleton-pill {
  background: linear-gradient(90deg, rgba(219, 213, 205, 0.62), rgba(244, 240, 235, 0.95), rgba(219, 213, 205, 0.62));
  background-size: 240% 100%;
  animation: shimmer 1.4s infinite;
}

.skeleton-cover {
  height: 196px;
}

.list-skeleton-cover {
  min-height: 160px;
}

.skeleton-body,
.list-skeleton-body {
  display: grid;
  gap: 12px;
  padding: 20px;
}

.skeleton-line {
  height: 14px;
  border-radius: 999px;
}

.skeleton-line-title {
  height: 28px;
  width: 92%;
}

.skeleton-line-short {
  width: 52%;
}

.skeleton-line-medium {
  width: 78%;
}

.skeleton-actions,
.skeleton-tags {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.skeleton-actions {
  justify-content: end;
}

.skeleton-pill {
  width: 84px;
  height: 40px;
  border-radius: 14px;
}

.skeleton-pill-short {
  width: 64px;
}

.sentinel {
  height: 1px;
}

.load-more-state {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  color: rgba(31, 45, 51, 0.66);
  padding: 12px 0 24px;
}

@media (max-width: 720px) {
  .results-head {
    flex-direction: column;
    align-items: start;
    gap: 12px;
  }

  .results-toolbar {
    width: 100%;
    justify-content: space-between;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
  }

  .view-switcher {
    justify-self: end;
    gap: 6px;
    padding: 6px 6px 6px 10px;
    box-shadow: none;
  }

  .view-switcher-label {
    font-size: 0.82rem;
  }

  .view-toggle :deep(.v-btn) {
    min-width: 40px;
  }

  .list-skeleton {
    grid-template-columns: 1fr;
  }

  .list-skeleton-cover {
    min-height: 180px;
  }

  .results-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .results-empty {
    min-height: 260px;
    padding: 24px 18px;
  }

  .view-toggle :deep(.v-btn),
  .skeleton-cover,
  .list-skeleton-cover,
  .skeleton-line,
  .skeleton-pill {
    transition: none;
    animation: none;
  }

  .card-skeleton,
  .list-skeleton,
  .view-switcher {
    box-shadow: none;
  }
}

@media (max-width: 560px) {
  .results-head h2 {
    font-size: 1.32rem;
  }

  .results-head p,
  .results-count {
    font-size: 0.9rem;
  }

  .results-head p {
    display: none;
  }

  .results-toolbar {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .view-switcher {
    width: 100%;
    justify-content: space-between;
  }

  .view-switcher-label {
    letter-spacing: 0.02em;
  }
}

@media (max-width: 420px) {
  .view-switcher-label {
    display: inline;
    font-size: 0.78rem;
  }

  .view-switcher {
    gap: 4px;
    padding-inline: 8px;
  }

  .view-toggle :deep(.v-btn) {
    min-width: 38px;
  }
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}
</style>
