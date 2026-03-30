<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SearchTagInput from './SearchTagInput.vue'
import { FILTER_GROUPS, isListFilter, isRangeFilter } from '../../config/filters'
import { getFieldLabel, getFilterValueLabel, type ListFilterKey, type RangeFilterKey, type SearchCriteriaDraft } from '../../types/search'

const props = defineProps<{
  draftCriteria: SearchCriteriaDraft
}>()

const { t } = useI18n()

const emit = defineEmits<{
  updateRange: [key: RangeFilterKey, value: [number, number]]
  updateList: [key: ListFilterKey, value: string[]]
}>()

function formatRangeLabel(value: [number, number], formatter?: (value: number) => string): string {
  const printer = formatter ?? ((current: number) => current.toString())
  const [start, end] = value
  return `${printer(start)} - ${printer(end)}`
}

function updateCombobox(key: ListFilterKey, value: unknown): void {
  if (!Array.isArray(value)) {
    emit('updateList', key, [])
    return
  }

  emit('updateList', key, value.map((item) => String(item)))
}

function toggleChipValue(key: ListFilterKey, option: string): void {
  const currentValues = draftValues(key)
  const nextValues = currentValues.includes(option)
    ? currentValues.filter((value) => value !== option)
    : [...currentValues, option]

  emit('updateList', key, nextValues)
}

function draftValues(key: ListFilterKey): string[] {
  return props.draftCriteria[key]
}
</script>

<template>
  <div class="filters-panel">
    <div class="filters-head">
      <div>
        <h2>{{ t('filters.panelTitle') }}</h2>
        <p>{{ t('filters.panelDescription') }}</p>
      </div>
    </div>

    <v-expansion-panels multiple variant="accordion" class="filters-accordion">
      <v-expansion-panel v-for="group in FILTER_GROUPS" :key="group.id" elevation="0" rounded="xl">
        <v-expansion-panel-title>
          <div>
            <div class="group-title">{{ t(group.titleKey) }}</div>
            <div class="group-description">{{ t(group.descriptionKey) }}</div>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="group-content">
            <template v-for="filter in group.filters" :key="filter.key">
              <div v-if="isRangeFilter(filter)" class="filter-block filter-block-range">
                <div class="filter-head">
                  <div>
                    <h3>{{ getFieldLabel(filter.key) }}</h3>
                    <p>{{ formatRangeLabel(draftCriteria[filter.key], filter.formatter) }}</p>
                  </div>
                </div>
                <v-range-slider
                  class="range-slider"
                  :model-value="draftCriteria[filter.key]"
                  :min="filter.min"
                  :max="filter.max"
                  :step="1"
                  strict
                  thumb-label="always"
                  color="primary"
                  @update:model-value="emit('updateRange', filter.key, $event as [number, number])"
                >
                  <template #prepend>
                    <span class="range-edge">{{ filter.formatter ? filter.formatter(filter.min) : filter.min }}</span>
                  </template>
                  <template #append>
                    <span class="range-edge">{{ filter.formatter ? filter.formatter(filter.max) : filter.max }}</span>
                  </template>
                </v-range-slider>
              </div>

              <div v-else-if="isListFilter(filter)" class="filter-block">
                <div class="filter-head">
                  <div>
                    <h3>{{ getFieldLabel(filter.key) }}</h3>
                    <p>{{ filter.hintKey ? t(filter.hintKey) : t('filters.selectedCount', { count: draftCriteria[filter.key].length }) }}</p>
                  </div>
                </div>

                <SearchTagInput
                  v-if="filter.type === 'taglist'"
                  :label="getFieldLabel(filter.key)"
                  :items="filter.items"
                  :model-value="draftCriteria[filter.key]"
                  :hint="filter.hintKey ? t(filter.hintKey) : undefined"
                  :suggestion-source="filter.suggestionSource"
                  @update:model-value="updateCombobox(filter.key, $event)"
                />

                <div
                  v-else
                  class="filter-chip-group"
                >
                  <v-chip
                    v-for="option in filter.items"
                    :key="option"
                    :class="{ 'selected-chip': draftValues(filter.key).includes(option) }"
                    filter
                    variant="outlined"
                    @click="toggleChipValue(filter.key, option)"
                  >
                    {{ getFilterValueLabel(filter.key, option) }}
                  </v-chip>
                </div>
              </div>
            </template>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<style scoped>
.filters-panel {
  display: grid;
  gap: 16px;
  align-content: start;
  grid-auto-rows: max-content;
}

.filters-accordion {
  padding-top: 12px;
  align-self: start;
}

:deep(.v-expansion-panels) {
  display: grid;
  gap: 14px;
}

:deep(.v-expansion-panels--variant-accordion > .v-expansion-panel::after) {
  opacity: 0;
  border-top: none;
}

:deep(.v-expansion-panel) {
  overflow: hidden;
  border: 1px solid var(--theme-border-soft);
  background: var(--surface-panel-muted);
  box-shadow:
    0 10px 20px rgba(56, 44, 34, 0.04),
    0 18px 28px rgba(56, 44, 34, 0.03);
  border-radius: 28px !important;
}

:deep(.v-expansion-panel__shadow),
:deep(.v-expansion-panel__bg) {
  border-radius: 28px !important;
}

:deep(.v-expansion-panel-title) {
  padding: 18px 20px;
  min-height: 112px;
  align-items: center;
}

:deep(.v-expansion-panel-title__overlay) {
  border-radius: 28px;
}

:deep(.v-expansion-panel-title__icon) {
  align-self: center;
  margin-top: 0;
}

:deep(.v-expansion-panel-title__icon .v-icon) {
  font-size: 1.5rem;
}

:deep(.v-expansion-panel-text__wrapper) {
  padding: 0 20px 20px;
}

.filters-head h2 {
  margin: 0;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: 1.4rem;
}

.filters-head p {
  margin: 8px 0 0;
  color: var(--text-soft);
}

.group-title {
  font-weight: 700;
}

.group-description {
  color: var(--text-muted);
  font-size: 0.92rem;
  margin-top: 4px;
}

.group-content {
  display: grid;
  gap: 20px;
}

.filter-block {
  display: grid;
  gap: 12px;
}

.filter-block-range {
  gap: 18px;
}

.filter-head h3 {
  margin: 0;
  font-size: 1rem;
}

.filter-head p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.range-edge {
  min-width: 50px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.range-slider {
  padding-top: 18px;
}

:deep(.selected-chip) {
  background: var(--theme-fill-soft);
  color: rgb(var(--v-theme-primary));
  border-color: rgba(var(--v-theme-primary), 0.28);
}

.filter-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
}

.filter-chip-group :deep(.v-chip) {
  flex: 0 0 auto;
  white-space: nowrap;
  max-width: 100%;
}

@media (max-width: 960px) {
  .filters-panel {
    gap: 10px;
  }

  .filters-accordion {
    padding-top: 0;
  }

  :deep(.v-expansion-panels) {
    gap: 12px;
  }

  :deep(.v-expansion-panel-title) {
    padding: 14px 18px;
    min-height: 92px;
  }

  :deep(.v-expansion-panel-text__wrapper) {
    padding: 0 18px 18px;
  }

  .filters-head h2 {
    font-size: 1.28rem;
  }

  .filters-head p {
    margin-top: 4px;
    font-size: 0.94rem;
  }

  .group-content {
    gap: 18px;
  }
}
</style>
