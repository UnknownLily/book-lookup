<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getFieldLabel, getFilterValueLabel, type SearchTag } from '../../types/search'

const props = defineProps<{
  tag: SearchTag
  compact?: boolean
}>()

const emit = defineEmits<{
  add: [tag: SearchTag]
  set: [tag: SearchTag]
}>()

const { t } = useI18n()

const open = ref(false)

function getTagText(tag: SearchTag): string {
  return getFilterValueLabel(tag.field, tag.displayValue ?? tag.value)
}

async function copyValue(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.tag.displayValue ?? props.tag.value)
  } finally {
    open.value = false
  }
}

function addToFilter(): void {
  emit('add', props.tag)
  open.value = false
}

function setAsFilter(): void {
  emit('set', props.tag)
  open.value = false
}
</script>

<template>
  <v-menu v-model="open" location="bottom start" content-class="tag-action-menu">
    <template #activator="{ props: activatorProps }">
      <v-chip
        v-bind="activatorProps"
        class="tag-chip"
        :class="{ 'tag-chip--compact': compact }"
        color="secondary"
        variant="tonal"
        :size="compact ? 'small' : 'default'"
      >
        {{ getTagText(tag) }}
      </v-chip>
    </template>

    <v-list class="tag-menu-list" min-width="220" density="compact" rounded="xl">
      <v-list-subheader>{{ getFieldLabel(tag.field) }}</v-list-subheader>
      <v-list-item prepend-icon="$copyContent" :title="t('actions.copyText')" @click="copyValue" />
      <v-list-item
        prepend-icon="$addFilter"
        :title="t('actions.addToFilters')"
        :disabled="!tag.filterable"
        @click="addToFilter"
      />
      <v-list-item
        prepend-icon="$applyFilter"
        :title="t('actions.setAsFilter')"
        :disabled="!tag.filterable"
        @click="setAsFilter"
      />
      <v-divider class="my-1" />
      <v-list-item prepend-icon="$closeCircle" :title="t('actions.cancel')" @click="open = false" />
    </v-list>
  </v-menu>
</template>

<style scoped>
.tag-chip {
  cursor: pointer;
  color: rgb(var(--v-theme-primary));
  background: rgb(255, 233, 240);
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  box-shadow: 0 6px 14px rgba(92, 52, 68, 0.08);
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.tag-chip:hover,
.tag-chip:focus-visible {
  background: rgb(255, 223, 233);
  border-color: rgba(var(--v-theme-primary), 0.28);
  box-shadow: 0 10px 20px rgba(92, 52, 68, 0.12);
  transform: translateY(-1px);
}

.tag-menu-list {
  border-radius: var(--search-menu-radius) !important;
  background: rgb(255, 255, 255) !important;
}

.tag-menu-list :deep(.v-list-item) {
  border-radius: 14px;
}

.tag-chip--compact {
  --v-chip-height: 24px;
  font-size: 0.78rem;
}

.tag-chip--compact :deep(.v-chip__content) {
  padding-inline: 2px;
}
</style>

<style>
.tag-action-menu {
  border-radius: var(--search-menu-radius);
}

.tag-action-menu .v-overlay__content,
.tag-action-menu .v-list,
.tag-action-menu .v-sheet {
  background: rgb(255, 255, 255) !important;
  color: rgba(31, 45, 51, 0.9) !important;
}

.tag-action-menu .v-list {
  border: 1px solid rgba(var(--v-theme-primary), 0.12);
  box-shadow:
    0 14px 28px rgba(56, 44, 34, 0.08),
    0 24px 44px rgba(56, 44, 34, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.58);
}

.tag-action-menu .v-list-subheader,
.tag-action-menu .v-divider {
  background: transparent !important;
}

.tag-action-menu .v-list-item {
  border-radius: 14px;
}

.tag-action-menu .v-list-item:hover {
  background: rgba(227, 143, 167, 0.08) !important;
}

.tag-action-menu .v-list-item--active {
  background: rgba(227, 143, 167, 0.12) !important;
}
</style>
