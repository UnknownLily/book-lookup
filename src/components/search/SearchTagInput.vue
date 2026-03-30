<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { currentLocale } from '../../i18n'
import { getTagSuggestions } from '../../services/tagSuggestions'

const props = defineProps<{
  label: string
  hint?: string
  modelValue: string[]
  items: string[]
  suggestionSource?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { t } = useI18n()

const search = ref('')
const loading = ref(false)
const suggestions = ref<string[]>([])
const statusMessage = ref(props.hint ?? t('tagInput.fallbackHint'))
const sourceBadge = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let currentController: AbortController | null = null

function normalize(values: unknown[]): string[] {
  const seen = new Set<string>()
  return values
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
    .filter((value) => {
      if (seen.has(value)) {
        return false
      }

      seen.add(value)
      return true
    })
}

const items = computed(() => normalize([...props.modelValue, ...suggestions.value]).slice(0, 50))

async function loadSuggestions(term: string): Promise<void> {
  currentController?.abort()
  currentController = new AbortController()

  loading.value = true
  statusMessage.value = term.trim()
    ? t('tagInput.loading')
    : props.hint ?? t('tagInput.fallbackHint')

  try {
    const result = await getTagSuggestions({
      term,
      staticItems: props.items,
      selected: props.modelValue,
      suggestionSource: props.suggestionSource,
      signal: currentController.signal,
    })

    suggestions.value = result.suggestions

    if (!term.trim()) {
      sourceBadge.value = result.remoteAvailable ? t('tagInput.remoteReady') : t('tagInput.localFallback')
    } else if (result.source === 'remote') {
      sourceBadge.value = t('tagInput.remoteOnly')
    } else if (result.source === 'mixed') {
      sourceBadge.value = t('tagInput.mixed')
    } else {
      sourceBadge.value = result.remoteAvailable ? t('tagInput.localOnly') : t('tagInput.localFallbackBadge')
    }

    if (term.trim() && suggestions.value.length === 0) {
      statusMessage.value = t('tagInput.noResult')
    } else if (!result.remoteAvailable && term.trim()) {
      statusMessage.value = result.errorMessage
        ? `${t('tagInput.remoteUnavailable')}${result.errorMessage}`
        : t('tagInput.remoteUnavailable')
    } else {
      statusMessage.value = props.hint ?? t('tagInput.fallbackStatus')
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      statusMessage.value = t('tagInput.unavailable')
      sourceBadge.value = t('tagInput.localFallbackBadge')
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => search.value,
  (term) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      void loadSuggestions(term)
    }, 350)
  },
)

watch(
  () => props.items,
  () => {
    void loadSuggestions(search.value)
  },
  { deep: true },
)

watch(currentLocale, () => {
  void loadSuggestions(search.value)
})

function handleModelValue(value: unknown): void {
  if (!Array.isArray(value)) {
    emit('update:modelValue', [])
    return
  }

  emit('update:modelValue', normalize(value))
}

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  currentController?.abort()
})
</script>

<template>
  <v-combobox
    class="tag-input"
    rounded="xl"
    :label="label"
    :hint="statusMessage"
    persistent-hint
    :menu-props="{ contentClass: 'tag-input-menu' }"
    :items="items"
    :model-value="modelValue"
    :search="search"
    multiple
    clearable
    chips
    closable-chips
    hide-selected
    hide-no-data
    no-filter
    @update:search="search = String($event ?? '')"
    @update:model-value="handleModelValue"
  >
    <template #append-inner>
      <div class="tag-input-actions">
        <v-progress-circular
          v-if="loading"
          size="18"
          width="2"
          indeterminate
          color="primary"
        />
        <v-icon icon="$search" />
      </div>
    </template>

    <template #prepend-item>
      <div class="search-tip">
        <div class="search-tip-head">
          <div class="search-tip-title">{{ t('tagInput.panelTitle') }}</div>
          <span v-if="sourceBadge" class="source-badge">{{ sourceBadge }}</span>
        </div>
        <div class="search-tip-text">{{ t('tagInput.panelText') }}</div>
      </div>
    </template>
  </v-combobox>
</template>

<style scoped>
.tag-input {
  width: 100%;
}

.tag-input-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.search-tip {
  padding: 12px 16px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-primary), 0.16);
}

.search-tip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.search-tip-title {
  font-size: 0.86rem;
  font-weight: 700;
  color: rgba(31, 45, 51, 0.82);
}

.source-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--v-theme-secondary), 0.14);
  color: rgb(var(--v-theme-secondary));
  font-size: 0.76rem;
  white-space: nowrap;
}

.search-tip-text {
  margin-top: 4px;
  font-size: 0.82rem;
  color: rgba(31, 45, 51, 0.58);
}

:deep(.v-field) {
  border-radius: var(--search-input-radius);
}

:deep(.v-field__outline) {
  --v-field-border-radius: var(--search-input-radius);
}

:deep(.v-field__input) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-content: flex-start;
  gap: 8px;
  padding-top: 10px;
  padding-bottom: 10px;
  overflow-x: visible;
  overflow-y: visible;
  min-height: 56px;
}

:deep(.v-combobox__selection) {
  flex: 0 0 auto;
  max-width: 100%;
  margin-inline-end: 0;
}

:deep(.v-chip) {
  flex: 0 0 auto;
  max-width: 100%;
  white-space: nowrap;
}

:deep(.v-field__append-inner),
:deep(.v-field__clearable) {
  align-self: center;
  padding-top: 0;
}

.tag-input-actions :deep(.v-icon) {
  color: rgba(31, 45, 51, 0.58);
}
</style>

<style>
.tag-input-menu {
  border-radius: 24px;
}

.tag-input-menu .v-overlay__content,
.tag-input-menu .v-list,
.tag-input-menu .v-sheet {
  background: linear-gradient(180deg, rgb(255, 250, 252) 0%, rgb(252, 244, 248) 100%) !important;
  color: rgba(31, 45, 51, 0.9) !important;
}

.tag-input-menu .v-list-item {
  border-radius: 14px;
}

.tag-input-menu .v-list-item:hover {
  background: rgba(227, 143, 167, 0.08) !important;
}

.tag-input-menu .v-list-item--active {
  background: rgba(227, 143, 167, 0.12) !important;
}
</style>
