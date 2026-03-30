<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { currentLocale, localeOptions, setLocale, type SupportedLocale } from '../../i18n'
import { getKeywordSuggestions, type KeywordSuggestion } from '../../services/keywordResolver'
import { getFieldLabel, getFilterValueLabel, type SearchTag } from '../../types/search'

const props = defineProps<{
  keyword: string
  quickTags: SearchTag[]
  summary: string[]
  totalCount: number
  hasPendingChanges: boolean
  isLoading: boolean
  isRefreshing: boolean
}>()

const { t } = useI18n()

const canApply = computed(() => props.hasPendingChanges)

const statusBadgeText = computed(() => {
  if (props.hasPendingChanges) {
    return t('status.pendingChanges')
  }

  if (props.isRefreshing) {
    return t('status.refreshing')
  }

  return ''
})

const selectedSuggestionItems = computed<KeywordSuggestion[]>(() =>
  props.quickTags.map((tag) => ({
    key: tag.field as KeywordSuggestion['key'],
    value: tag.value,
    fieldLabel: getFieldLabel(tag.field),
  })),
)
const selectedSuggestionKeys = computed(() => new Set(selectedSuggestionItems.value.map((item) => `${item.key}::${item.value}`)))

const suggestionItems = ref<KeywordSuggestion[]>([])
const suggestionLoading = ref(false)
const suggestionHint = ref(t('topBar.suggestionHintInitial'))
const suggestionMenuOpen = ref(false)
const localeMenuOpen = ref(false)
const selectedLocale = computed({
  get: () => currentLocale.value,
  set: (value: SupportedLocale) => setLocale(value),
})
const localizedLocaleOptions = computed(() => localeOptions.map((item) => ({ value: item.value, title: t(item.labelKey) })))
const currentLocaleTitle = computed(() => localizedLocaleOptions.value.find((item) => item.value === selectedLocale.value)?.title ?? '')
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let currentController: AbortController | null = null

async function loadSuggestions(term: string): Promise<void> {
  currentController?.abort()

  if (!term.trim()) {
    suggestionItems.value = []
    suggestionHint.value = t('topBar.suggestionHintEmpty')
    suggestionLoading.value = false
    suggestionMenuOpen.value = false
    return
  }

  currentController = new AbortController()
  suggestionLoading.value = true
  suggestionHint.value = t('topBar.suggestionHintLoading')

  try {
    const nextSuggestions = await getKeywordSuggestions(term, currentController.signal)
    suggestionItems.value = nextSuggestions.filter((item) => !selectedSuggestionKeys.value.has(`${item.key}::${item.value}`))
    suggestionMenuOpen.value = suggestionItems.value.length > 0
    suggestionHint.value = suggestionItems.value.length > 0
      ? suggestionItems.value.length === 1
        ? t('topBar.suggestionHintSingle')
        : t('topBar.suggestionHintMultiple')
      : nextSuggestions.length > 0
        ? t('topBar.suggestionHintAlreadySelected')
      : t('topBar.suggestionHintNoResult')
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      suggestionItems.value = []
      suggestionHint.value = t('topBar.suggestionHintUnavailable')
      suggestionMenuOpen.value = false
    }
  } finally {
    suggestionLoading.value = false
  }
}

watch(
  () => props.keyword,
  (term) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      void loadSuggestions(term)
    }, 250)
  },
  { immediate: true },
)

watch(currentLocale, () => {
  void loadSuggestions(props.keyword)
})

function handleKeywordInput(value: unknown): void {
  emit('updateKeyword', String(value ?? ''))
}

function handleSuggestionPick(item: KeywordSuggestion): void {
  suggestionMenuOpen.value = false
  emit('addQuickTag', {
    field: item.key,
    label: item.fieldLabel,
    value: item.value,
    filterable: true,
  })
  emit('updateKeyword', '')
}

function handleKeywordEnter(): void {
  if (!suggestionLoading.value && props.keyword.trim() && suggestionItems.value.length === 1) {
    handleSuggestionPick(suggestionItems.value[0])
    return
  }

  if (canApply.value) {
    emit('apply')
  }
}

function handleLocalePick(locale: SupportedLocale): void {
  selectedLocale.value = locale
  localeMenuOpen.value = false
}

function handleKeywordFocus(): void {
  if (props.keyword.trim() && suggestionItems.value.length > 0) {
    suggestionMenuOpen.value = true
  }
}

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  currentController?.abort()
})

const emit = defineEmits<{
  updateKeyword: [value: string]
  apply: []
  clear: []
  openFilters: []
  addQuickTag: [tag: SearchTag]
  removeQuickTag: [tag: SearchTag]
}>()
</script>

<template>
  <v-card class="top-bar" variant="flat">
    <div class="top-main">
      <div class="top-search">
        <div class="intro-copy">
          <span class="eyebrow">{{ t('app.altName') }}</span>
          <h1>{{ t('app.title') }}</h1>
          <p>{{ t('app.introBeforeLink') }}<a href="https://thwiki.cc/rest/askbook/v0/" target="_blank" rel="noopener noreferrer">{{ t('app.introLinkText') }}</a>{{ t('app.introAfterLink') }}</p>
        </div>

        <div class="keyword-input-block">
          <v-menu
            v-model="suggestionMenuOpen"
            :close-on-content-click="false"
            :open-on-click="false"
            :open-on-focus="false"
            location="bottom"
            offset="10"
          >
            <template #activator="{ props: menuProps }">
              <v-text-field
                v-bind="menuProps"
                class="keyword-input"
                rounded="xl"
                :model-value="keyword"
                :hint="suggestionHint"
                persistent-hint
                :label="t('topBar.quickTagLabel')"
                :placeholder="t('topBar.quickTagPlaceholder')"
                prepend-inner-icon="$search"
                clearable
                @update:model-value="handleKeywordInput"
                @focus="handleKeywordFocus"
                @click:clear="emit('updateKeyword', '')"
                @keyup.enter="handleKeywordEnter"
              >
                <template #append-inner>
                  <div class="keyword-actions">
                    <v-progress-circular
                      v-if="suggestionLoading"
                      size="18"
                      width="2"
                      indeterminate
                      color="primary"
                    />
                    <v-btn
                      variant="text"
                      density="comfortable"
                      icon="$expand"
                      class="keyword-toggle"
                      @click.stop="suggestionMenuOpen = !suggestionMenuOpen"
                    />
                  </div>
                </template>
              </v-text-field>
            </template>

            <v-card class="keyword-menu" rounded="xl" variant="flat">
              <div class="keyword-tip">
                <div class="keyword-tip-head">
                  <div class="keyword-tip-title">{{ t('topBar.suggestionPanelTitle') }}</div>
                  <span class="keyword-tip-badge">{{ t('topBar.suggestionPanelBadge') }}</span>
                </div>
                <div class="keyword-tip-text">{{ t('topBar.suggestionPanelText') }}</div>
              </div>

              <v-list class="keyword-list" density="comfortable">
                <v-list-item
                  v-for="item in suggestionItems"
                  :key="`${item.key}-${item.value}`"
                  :title="item.value"
                  :subtitle="item.fieldLabel"
                  @click="handleSuggestionPick(item)"
                />
              </v-list>
            </v-card>
          </v-menu>
        </div>

        <div v-if="selectedSuggestionItems.length > 0" class="quick-tags-row">
          <v-chip
            v-for="item in selectedSuggestionItems"
            :key="`${item.key}-${item.value}`"
            size="small"
            closable
            class="quick-tag-chip"
            @click:close="emit('removeQuickTag', { field: item.key, label: item.fieldLabel, value: item.value, filterable: true })"
          >
            {{ `${item.fieldLabel}：${getFilterValueLabel(item.key, item.value)}` }}
          </v-chip>
        </div>
      </div>

        <div class="top-actions">
        <v-menu
          v-model="localeMenuOpen"
          location="bottom end"
          offset="10"
        >
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              class="locale-select"
              variant="outlined"
              rounded="xl"
              append-icon="$expand"
              :aria-label="`${t('locale.label')} ${currentLocaleTitle}`"
            >
              <span class="locale-select-icon" aria-hidden="true">
                <v-icon icon="$language" size="18" />
              </span>
              <span class="locale-select-value">{{ currentLocaleTitle }}</span>
            </v-btn>
          </template>

          <v-card class="keyword-menu locale-menu-card" rounded="xl" variant="flat">
            <div class="keyword-tip locale-tip">
              <div class="keyword-tip-head">
                <div class="keyword-tip-title">{{ t('locale.label') }}</div>
                <span class="keyword-tip-badge">{{ currentLocaleTitle }}</span>
              </div>
              <div class="keyword-tip-text">{{ t('locale.menuDescription') }}</div>
            </div>

            <v-list class="keyword-list locale-list" density="comfortable">
              <v-list-item
                v-for="item in localizedLocaleOptions"
                :key="item.value"
                :active="item.value === selectedLocale"
                @click="handleLocalePick(item.value)"
              >
                <template #title>
                  <span class="locale-option-title">{{ item.title }}</span>
                </template>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>

        <v-btn class="mobile-filters top-action-btn" variant="outlined" prepend-icon="$filters" @click="emit('openFilters')">
          {{ t('actions.filter') }}
        </v-btn>

      </div>
    </div>

    <div v-if="statusBadgeText" class="status-pill-row">
      <span class="pending-pill">{{ statusBadgeText }}</span>
    </div>

    <div class="top-meta">
      <div class="summary-chips">
        <v-chip v-for="item in summary.slice(0, 8)" :key="item" variant="tonal" color="secondary">
          {{ item }}
        </v-chip>
        <span v-if="summary.length === 0" class="meta-text">{{ t('status.noActiveFilters') }}</span>
      </div>

      <div class="status-panel">
        <span class="meta-text">{{ totalCount > 0 ? t('status.totalCount', { count: totalCount }) : t('status.readyToSearch') }}</span>
        <div class="status-actions">
          <v-btn class="top-action-btn apply-action-btn" color="primary" :loading="isLoading" :disabled="!canApply" @click="emit('apply')">
            {{ t('actions.applyFilters') }}
          </v-btn>
          <v-btn class="top-action-btn" variant="text" @click="emit('clear')">{{ t('actions.clearFilters') }}</v-btn>
        </div>
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.top-bar {
  --top-primary-pill-bg: rgba(var(--v-theme-primary), 0.16);
  --top-primary-pill-bg-hover: rgba(var(--v-theme-primary), 0.22);
  --top-primary-pill-fg: rgb(var(--v-theme-primary));
  --top-primary-pill-border: rgba(var(--v-theme-primary), 0.22);
  --top-primary-pill-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 8px 18px rgba(92, 52, 68, 0.08);
  background: linear-gradient(180deg, var(--surface-panel-strong), var(--surface-panel-soft));
  border: 1px solid var(--theme-border-soft);
  box-shadow: var(--shadow-elevated);
  padding: 24px;
}

.top-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: start;
}

.top-search {
  display: grid;
  gap: 18px;
  flex: 1;
}

.keyword-input-block {
  min-width: 0;
}

.keyword-input :deep(.v-field) {
  border-radius: var(--search-input-radius);
}

.keyword-input :deep(.v-field__outline) {
  --v-field-border-radius: var(--search-input-radius);
}

.keyword-input :deep(.v-field__overlay) {
  background: transparent;
}

.keyword-input :deep(.v-field__input) {
  min-height: 56px;
  padding-top: 10px;
  padding-bottom: 10px;
}

.keyword-input :deep(.v-field__append-inner) {
  align-self: center;
  padding-top: 0;
}

.keyword-input :deep(.v-input__details) {
  padding-inline: 4px;
}

.keyword-input :deep(.v-messages) {
  min-height: 18px;
}

.keyword-input :deep(.v-messages__message) {
  line-height: 1.4;
}

.quick-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  align-content: start;
}

.locale-select {
  min-width: 176px;
  min-height: 54px;
  justify-content: flex-start;
  padding-inline: 18px;
  border-radius: var(--search-input-radius);
  border-color: rgba(41, 60, 64, 0.72) !important;
  color: var(--text-strong) !important;
  background: transparent !important;
  box-shadow: none !important;
}

.locale-select:hover,
.locale-select:focus-visible {
  border-color: rgba(41, 60, 64, 0.88) !important;
  background: rgba(255, 255, 255, 0.34) !important;
}

.locale-select :deep(.v-btn__content) {
  justify-content: flex-start;
  width: 100%;
  gap: 12px;
  font-size: 1rem;
  font-weight: 500;
}

.locale-select :deep(.v-btn__append) {
  margin-inline-start: auto;
  color: rgba(31, 45, 51, 0.48);
}

.locale-select-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  color: var(--text-soft);
  line-height: 1;
  flex: 0 0 auto;
}

.locale-select-icon :deep(.v-icon) {
  display: block;
  font-size: 18px;
}

.locale-select-value {
  color: var(--text-strong);
}

.quick-tag-chip {
  max-width: min(240px, 32vw);
}

.quick-tag-chip :deep(.v-chip__content) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.keyword-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.keyword-toggle {
  margin-inline-end: -6px;
}

.keyword-menu {
  width: min(720px, calc(100vw - 48px));
  border: 1px solid rgba(var(--v-theme-primary), 0.12);
  box-shadow:
    0 14px 28px rgba(56, 44, 34, 0.08),
    0 24px 44px rgba(56, 44, 34, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.58);
  overflow: hidden;
  background: linear-gradient(180deg, rgb(255, 253, 254) 0%, rgb(252, 248, 251) 100%) !important;
}

.keyword-list {
  padding: 8px;
  background: transparent !important;
}

.keyword-list :deep(.v-list-item) {
  margin: 2px 0;
  border-radius: 14px;
  transition: background-color 160ms ease;
}

.keyword-list :deep(.v-list-item:hover) {
  background: rgba(227, 143, 167, 0.08) !important;
}

.keyword-list :deep(.v-list-item--active) {
  background: rgba(227, 143, 167, 0.12) !important;
}

.keyword-tip {
  padding: 12px 16px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-primary), 0.1);
  background: transparent !important;
}

.keyword-tip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.keyword-tip-title {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--text-strong);
}

.keyword-tip-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--theme-fill-secondary);
  color: rgb(var(--v-theme-secondary));
  font-size: 0.76rem;
  white-space: nowrap;
}

.keyword-tip-text {
  margin-top: 4px;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.locale-menu-card {
  width: min(248px, calc(100vw - 48px));
}

.locale-tip {
  padding-bottom: 10px;
}

.locale-list :deep(.v-list-item) {
  min-height: 50px;
}

.locale-list :deep(.v-list-item--active) {
  background: rgba(227, 143, 167, 0.07) !important;
}

.locale-option-title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-strong);
}

.top-action-btn,
.view-toggle {
  border-radius: var(--search-control-radius);
}

.apply-action-btn {
  color: rgb(255, 250, 252) !important;
  background: rgb(var(--v-theme-primary)) !important;
  border: 1px solid rgba(var(--v-theme-primary), 0.96);
  box-shadow: 0 10px 22px rgba(92, 52, 68, 0.22);
}

.apply-action-btn:hover,
.apply-action-btn:focus-visible {
  background: rgba(var(--v-theme-primary), 0.9) !important;
  border-color: rgba(var(--v-theme-primary), 0.98);
  box-shadow: 0 14px 28px rgba(92, 52, 68, 0.28);
}

.apply-action-btn :deep(.v-btn__content),
.apply-action-btn :deep(.v-icon) {
  color: inherit;
}

.top-action-btn :deep(.v-btn__overlay),
.top-action-btn :deep(.v-btn__underlay) {
  border-radius: inherit;
}

.apply-action-btn.v-btn--disabled {
  background-color: rgba(var(--v-theme-primary), 0.46) !important;
  color: rgba(255, 248, 250, 0.82) !important;
  border-color: rgba(var(--v-theme-primary), 0.42) !important;
  box-shadow: 0 6px 14px rgba(92, 52, 68, 0.12) !important;
  opacity: 1 !important;
}

.apply-action-btn.v-btn--disabled .v-btn__content {
  color: inherit !important;
}

.apply-action-btn.v-btn--disabled .v-btn__overlay,
.apply-action-btn.v-btn--disabled .v-btn__underlay {
  opacity: 0 !important;
}

.view-toggle :deep(.v-btn) {
  border-radius: var(--search-control-radius);
}

.view-toggle :deep(.v-btn__overlay),
.view-toggle :deep(.v-btn__underlay) {
  border-radius: inherit;
}

.intro-copy h1 {
  margin: 6px 0 8px;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  line-height: 1.15;
}

.intro-copy p {
  margin: 0;
  max-width: 720px;
  color: var(--text-soft);
}

.intro-copy a {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  text-decoration-color: rgba(var(--v-theme-primary), 0.32);
  text-underline-offset: 0.16em;
  transition:
    color 160ms ease,
    text-decoration-color 160ms ease;
}

.intro-copy a:visited {
  color: rgb(var(--v-theme-primary));
}

.intro-copy a:hover,
.intro-copy a:focus-visible {
  color: rgb(var(--v-theme-accent));
  text-decoration-color: rgba(var(--v-theme-accent), 0.6);
}

.intro-copy a[target='_blank']::after {
  content: '↗';
  display: inline-block;
  margin-left: 0.18em;
  font-size: 0.82em;
  line-height: 1;
  transform: translateY(-0.04em);
}

.eyebrow {
  display: inline-block;
  padding: 5px 12px;
  border-radius: var(--search-control-radius);
  background: var(--top-primary-pill-bg);
  color: var(--top-primary-pill-fg);
  border: 1px solid var(--top-primary-pill-border);
  box-shadow: var(--top-primary-pill-shadow);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.top-actions {
  display: flex;
  align-items: start;
  align-content: start;
  gap: 12px;
  flex-wrap: nowrap;
  justify-content: end;
  min-height: 2.75rem;
}

.top-meta {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--theme-border-soft);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: start;
}

.summary-chips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-content: start;
  min-height: 2rem;
}

.status-panel {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: end;
  flex-wrap: nowrap;
}

.status-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
}

.meta-text {
  color: var(--text-muted);
  font-size: 0.92rem;
}

.status-pill-row {
  margin-top: 16px;
  display: flex;
}

.pending-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: var(--search-control-radius);
  background: var(--top-primary-pill-bg);
  color: var(--top-primary-pill-fg);
  border: 1px solid var(--top-primary-pill-border);
  box-shadow: var(--top-primary-pill-shadow);
  font-size: 0.88rem;
  white-space: nowrap;
}

.mobile-filters {
  display: none;
}

.mobile-filters {
  border-radius: var(--search-input-radius) !important;
  border-color: rgba(41, 60, 64, 0.72) !important;
  padding-inline: 18px;
}

.mobile-filters :deep(.v-btn__overlay),
.mobile-filters :deep(.v-btn__underlay) {
  border-radius: var(--search-input-radius);
}

.mobile-filters:hover,
.mobile-filters:focus-visible {
  border-color: rgba(41, 60, 64, 0.88) !important;
  background: rgba(255, 255, 255, 0.34) !important;
}

@media (max-width: 960px) {
  .top-bar {
    padding: 20px;
  }

  .top-main {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .top-meta {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .top-actions,
  .status-panel {
    justify-content: start;
  }

  .top-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    column-gap: 12px;
    row-gap: 10px;
    min-height: 0;
    width: 100%;
  }

  .mobile-filters {
    display: inline-flex;
    order: 1;
    align-self: stretch;
    min-height: 54px;
    width: 100%;
  }

  .locale-select {
    order: 2;
    min-width: 0;
    width: 100%;
    min-height: 54px;
  }

  .intro-copy p {
    max-width: none;
  }

  .quick-tags-row {
    gap: 10px;
  }

  .quick-tag-chip {
    max-width: min(100%, 320px);
  }

  .status-panel {
    flex-wrap: wrap;
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .status-actions {
    flex-wrap: wrap;
    gap: 10px;
  }

  .apply-action-btn {
    flex: 1 1 220px;
    min-height: 50px;
  }

  .summary-chips {
    gap: 8px;
  }
}

@media (max-width: 720px) {
  .top-bar {
    padding: 16px;
    gap: 14px;
    box-shadow: none;
  }

  .top-search {
    gap: 14px;
  }

  .intro-copy h1 {
    font-size: clamp(1.8rem, 8vw, 2.35rem);
    line-height: 1.12;
  }

  .intro-copy p {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    overflow: hidden;
    font-size: 0.98rem;
  }

  .keyword-input :deep(.v-field__input) {
    min-height: 54px;
  }

  .keyword-input :deep(.v-input__details) {
    min-height: 16px;
    padding-top: 2px;
  }

  .keyword-input :deep(.v-messages__message) {
    font-size: 0.78rem;
  }

  .top-actions {
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 0.95fr);
    column-gap: 8px;
    row-gap: 6px;
  }

  .mobile-filters,
  .locale-select {
    order: initial;
    min-height: 48px;
  }

  .mobile-filters {
    grid-column: 1;
    grid-row: 1;
    padding-inline: 12px;
  }

  .locale-select {
    grid-column: 2;
    grid-row: 1;
    padding-inline: 12px;
  }

  .locale-select :deep(.v-btn__content) {
    gap: 6px;
    font-size: 0.9rem;
  }

  .mobile-filters :deep(.v-btn__content) {
    gap: 6px;
    font-size: 0.96rem;
  }

  .locale-select-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pending-pill {
    width: 100%;
    justify-content: center;
    white-space: normal;
    text-align: center;
  }

  .summary-chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 4px;
    margin-inline: -2px;
    padding-inline: 2px;
    scrollbar-width: none;
  }

  .summary-chips::-webkit-scrollbar {
    display: none;
  }

  .summary-chips :deep(.v-chip) {
    flex: 0 0 auto;
  }

  .status-actions {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 0.95fr);
    gap: 8px;
  }

  .top-action-btn {
    width: 100%;
  }

  .apply-action-btn {
    min-height: 50px;
    box-shadow: none;
  }

  .status-actions .top-action-btn:not(.apply-action-btn) {
    min-height: 50px;
  }

  .eyebrow,
  .pending-pill {
    box-shadow: none;
  }

  .keyword-menu {
    box-shadow: none;
  }
}

@media (max-width: 420px) {
  .top-bar {
    padding: 14px;
  }

  .top-actions {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.9fr);
    column-gap: 8px;
  }

  .status-actions {
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.9fr);
    gap: 6px;
  }

  .mobile-filters,
  .locale-select {
    min-height: 46px;
  }

  .mobile-filters {
    padding-inline: 10px;
  }

  .locale-select {
    padding-inline: 10px;
  }

  .mobile-filters :deep(.v-btn__content),
  .locale-select :deep(.v-btn__content) {
    gap: 5px;
    font-size: 0.88rem;
  }

  .eyebrow {
    padding: 4px 10px;
    font-size: 0.76rem;
  }

  .intro-copy p {
    font-size: 0.94rem;
  }

  .keyword-tip-text {
    font-size: 0.78rem;
  }
}
</style>
