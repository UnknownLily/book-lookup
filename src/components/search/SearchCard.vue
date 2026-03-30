<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import TagActionMenu from './TagActionMenu.vue'
import { getFieldLabel, type SearchResultItem, type SearchTag } from '../../types/search'

const props = defineProps<{
  item: SearchResultItem
}>()

const emit = defineEmits<{
  addTag: [tag: SearchTag]
  setTag: [tag: SearchTag]
}>()

const { t } = useI18n()

const cardRef = ref<HTMLElement | { $el?: Element | null } | null>(null)
const summaryRef = ref<HTMLElement | null>(null)
const mobileExpanded = ref(false)
const hasExpandableDetails = computed(() => props.item.detailSections.some((section) => section.tags.length > 0))
let summaryResizeObserver: ResizeObserver | null = null

function getCardElement(): HTMLElement | null {
  if (cardRef.value instanceof HTMLElement) {
    return cardRef.value
  }

  if (cardRef.value && '$el' in cardRef.value && cardRef.value.$el instanceof HTMLElement) {
    return cardRef.value.$el
  }

  return null
}

function toggleMobileExpanded(): void {
  if (typeof window === 'undefined') {
    return
  }

  if (!window.matchMedia('(max-width: 720px)').matches || !hasExpandableDetails.value) {
    return
  }

  mobileExpanded.value = !mobileExpanded.value
}

function handlePointerDown(event: PointerEvent): void {
  const cardElement = getCardElement()

  if (!mobileExpanded.value || !cardElement) {
    return
  }

  const target = event.target
  if (!(target instanceof Node)) {
    return
  }

  if (!cardElement.contains(target)) {
    mobileExpanded.value = false
  }
}

function handleWindowScroll(): void {
  if (mobileExpanded.value) {
    mobileExpanded.value = false
  }
}

function handleCollapseRequest(): void {
  if (mobileExpanded.value) {
    mobileExpanded.value = false
  }
}

function updateMobilePeekHeight(): void {
  const cardElement = getCardElement()

  if (typeof window === 'undefined' || !cardElement) {
    return
  }

  if (!window.matchMedia('(max-width: 720px)').matches || !summaryRef.value) {
    cardElement.style.removeProperty('--mobile-summary-height')
    return
  }

  cardElement.style.setProperty('--mobile-summary-height', `${summaryRef.value.offsetHeight}px`)
}

function handleWindowResize(): void {
  updateMobilePeekHeight()
}

function splitMetaLine(line: string): { label: string; value: string } {
  const firstSpaceIndex = line.indexOf(' ')

  if (firstSpaceIndex === -1) {
    return { label: line, value: '' }
  }

  return {
    label: line.slice(0, firstSpaceIndex),
    value: line.slice(firstSpaceIndex + 1),
  }
}

const isDarkCover = ref(false)
let toneAnalysisToken = 0

watch(
  () => props.item.coverUrl,
  (coverUrl) => {
    toneAnalysisToken += 1
    const currentToken = toneAnalysisToken
    isDarkCover.value = false

    if (!coverUrl) {
      return
    }

    void detectCoverTone(coverUrl, currentToken)
  },
  { immediate: true },
)

watch(
  () => props.item.id,
  async () => {
    mobileExpanded.value = false
    await nextTick()
    updateMobilePeekHeight()
  },
)

onMounted(async () => {
  document.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
  window.addEventListener('search-card-collapse', handleCollapseRequest)
  window.addEventListener('resize', handleWindowResize)

  await nextTick()
  updateMobilePeekHeight()

  if (typeof ResizeObserver !== 'undefined' && summaryRef.value) {
    summaryResizeObserver = new ResizeObserver(() => {
      updateMobilePeekHeight()
    })
    summaryResizeObserver.observe(summaryRef.value)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('scroll', handleWindowScroll)
  window.removeEventListener('search-card-collapse', handleCollapseRequest)
  window.removeEventListener('resize', handleWindowResize)
  summaryResizeObserver?.disconnect()
})

async function detectCoverTone(coverUrl: string, currentToken: number): Promise<void> {
  try {
    const image = await loadImageElement(coverUrl)
    const luminance = sampleTopAreaLuminance(image)

    if (currentToken !== toneAnalysisToken) {
      return
    }

    isDarkCover.value = luminance < 118
  } catch {
    if (currentToken !== toneAnalysisToken) {
      return
    }

    isDarkCover.value = false
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = src
  })
}

function sampleTopAreaLuminance(image: HTMLImageElement): number {
  const canvas = document.createElement('canvas')
  const width = 32
  const height = 32
  const sampleHeight = 18

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    return 255
  }

  context.drawImage(image, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, sampleHeight)

  let weightedLuminance = 0
  let totalWeight = 0

  for (let y = 0; y < sampleHeight; y += 1) {
    const verticalWeight = 1.2 - y / sampleHeight / 2

    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const alpha = data[index + 3] / 255

      if (alpha <= 0) {
        continue
      }

      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
      const weight = verticalWeight * alpha

      weightedLuminance += luminance * weight
      totalWeight += weight
    }
  }

  return totalWeight > 0 ? weightedLuminance / totalWeight : 255
}
</script>

<template>
  <v-card ref="cardRef" class="result-card" :class="{ 'tone-dark': isDarkCover, 'result-card--mobile-expanded': mobileExpanded }" variant="flat">
    <div
      v-if="item.coverUrl"
      class="card-image-blur"
      :style="{
        backgroundImage: `url(${item.coverUrl})`,
      }"
      aria-hidden="true"
    />
    <div v-if="item.coverUrl" class="card-image-wash" aria-hidden="true" />

    <div
      class="card-cover"
      :class="{ 'card-cover--tappable': hasExpandableDetails }"
      tabindex="0"
      @click="toggleMobileExpanded"
      @keyup.enter="toggleMobileExpanded"
      @keyup.space.prevent="toggleMobileExpanded"
    >
      <v-img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" class="cover-image" cover height="320" />
      <div v-else class="cover-fallback">
        <span>{{ t('app.noCover') }}</span>
      </div>
    </div>

    <div class="card-body" aria-hidden="true"></div>

    <div class="card-hover">
      <div ref="summaryRef" class="card-summary" :class="{ 'card-summary--tappable': hasExpandableDetails }" tabindex="0" @click="toggleMobileExpanded" @keyup.enter="toggleMobileExpanded" @keyup.space.prevent="toggleMobileExpanded">
        <div class="card-heading">
          <h3>{{ item.title }}</h3>
          <p>{{ item.subtitle }}</p>
          <div v-if="item.secondaryNames.length > 0" class="album-name-row">
            <span v-for="secondaryName in item.secondaryNames.slice(0, 2)" :key="secondaryName"><strong>{{ t('app.aliasPrefix') }}</strong>{{ secondaryName }}</span>
          </div>
          <div v-if="item.meta.length > 0" class="card-meta">
            <span v-for="line in item.meta" :key="line">
              <template v-for="part in [splitMetaLine(line)]" :key="part.label + part.value">
                <strong>{{ part.label }}</strong><span v-if="part.value"> {{ part.value }}</span>
              </template>
            </span>
          </div>
        </div>

        <div class="card-actions">
          <v-btn
            class="result-action-btn"
            color="primary"
            variant="tonal"
            append-icon="$externalLink"
            :href="item.wikiUrl"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >
            {{ t('app.wikiAction') }}
          </v-btn>

          <v-btn
            v-for="link in item.links.slice(0, 2)"
            :key="link.key"
            class="result-link-btn"
            size="small"
            variant="tonal"
            color="secondary"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >
            {{ link.label }}
          </v-btn>
        </div>
      </div>

      <div class="detail-list" :class="{ 'detail-list--mobile-open': mobileExpanded }">
        <div v-for="section in item.detailSections.slice(0, 6)" :key="section.key" class="detail-section">
          <div class="detail-label">{{ getFieldLabel(section.key) }}</div>
          <div class="tag-row">
            <TagActionMenu
              v-for="tag in section.tags.slice(0, 4)"
              :key="`${item.id}-${tag.field}-${tag.value}`"
              :tag="tag"
              compact
              @click.stop
              @add="emit('addTag', $event)"
              @set="emit('setTag', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.result-card {
  --card-summary-min-height: 220px;
  --card-heading-height: 174px;
  --card-title-color: rgba(31, 45, 51, 0.94);
  --card-body-color: var(--text-soft);
  --card-muted-color: var(--text-muted);
  --card-link-color: rgba(31, 45, 51, 0.82);
  --card-link-opacity: 0.78;
  --card-surface-bg: linear-gradient(180deg, rgba(255, 251, 252, 0.98), rgba(248, 240, 244, 0.94));
  --card-image-wash-bg:
    radial-gradient(circle at 86% 18%, rgba(255, 255, 255, 0.16), transparent 24%),
    radial-gradient(circle at 76% 64%, rgba(255, 252, 253, 0.12), transparent 30%),
    radial-gradient(circle at 62% 50%, rgba(255, 255, 255, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 252, 253, 0.06) 18%, rgba(255, 249, 251, 0.18) 38%, rgba(255, 247, 249, 0.38) 62%, rgba(255, 245, 248, 0.7) 100%);
  --card-hover-bg:
    linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 252, 253, 0) 56%, rgba(255, 250, 251, 0.012) 68%, rgba(255, 248, 250, 0.04) 80%, rgba(255, 247, 249, 0.14) 90%, rgba(255, 245, 248, 0.36) 100%),
    radial-gradient(circle at 84% 10%, rgba(255, 255, 255, 0.12), transparent 26%);
  --card-hover-before-bg:
    linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 252, 253, 0.012) 14%, rgba(255, 250, 251, 0.04) 30%, rgba(255, 248, 250, 0.1) 46%, rgba(255, 246, 248, 0.2) 64%, rgba(255, 244, 247, 0.3) 100%),
    radial-gradient(circle at 24% 18%, rgba(255, 255, 255, 0.22), transparent 24%),
    radial-gradient(circle at 80% 8%, rgba(255, 255, 255, 0.16), transparent 28%);
  --card-action-fg: rgb(var(--v-theme-primary));
  --card-action-bg: rgb(255, 233, 240);
  --card-action-border: rgba(var(--v-theme-primary), 0.18);
  --card-action-hover-fg: rgb(var(--v-theme-primary));
  --card-action-hover-bg: rgb(255, 223, 233);
  --card-action-hover-border: rgba(var(--v-theme-primary), 0.28);
  --card-summary-text-shadow: none;
  overflow: hidden;
  position: relative;
  background: var(--card-surface-bg);
  border: 1px solid var(--theme-border-soft);
  box-shadow: var(--shadow-card-depth);
  isolation: isolate;
  transition:
    transform 240ms ease,
    box-shadow 240ms ease,
    border-color 240ms ease;
}

.result-card.tone-dark {
  --card-image-wash-bg:
    radial-gradient(circle at 86% 18%, rgba(255, 255, 255, 0.2), transparent 24%),
    radial-gradient(circle at 76% 64%, rgba(255, 250, 252, 0.14), transparent 30%),
    radial-gradient(circle at 62% 50%, rgba(255, 255, 255, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(255, 250, 252, 0) 0%, rgba(255, 249, 251, 0.08) 18%, rgba(255, 246, 249, 0.24) 38%, rgba(255, 243, 247, 0.44) 62%, rgba(255, 240, 245, 0.74) 100%);
  --card-hover-bg:
    linear-gradient(180deg, rgba(255, 250, 252, 0) 0%, rgba(255, 249, 251, 0) 56%, rgba(255, 247, 250, 0.01) 68%, rgba(255, 245, 248, 0.036) 80%, rgba(255, 242, 246, 0.12) 90%, rgba(255, 239, 244, 0.32) 100%),
    radial-gradient(circle at 84% 10%, rgba(255, 255, 255, 0.12), transparent 26%);
  --card-hover-before-bg:
    linear-gradient(180deg, rgba(255, 250, 252, 0) 0%, rgba(255, 249, 251, 0.01) 14%, rgba(255, 247, 250, 0.034) 30%, rgba(255, 245, 248, 0.09) 46%, rgba(255, 241, 246, 0.18) 64%, rgba(255, 238, 243, 0.28) 100%),
    radial-gradient(circle at 24% 18%, rgba(255, 255, 255, 0.22), transparent 24%),
    radial-gradient(circle at 80% 8%, rgba(255, 255, 255, 0.16), transparent 28%);
}

.result-card.tone-dark:hover,
.result-card.tone-dark:focus-within {
  --card-title-color: rgba(255, 249, 251, 0.96);
  --card-body-color: rgba(255, 242, 247, 0.88);
  --card-muted-color: rgba(255, 237, 244, 0.78);
  --card-summary-text-shadow: 0 1px 2px rgba(17, 10, 14, 0.32);
  --card-action-bg: rgb(90, 61, 75);
  --card-action-border: rgba(255, 235, 242, 0.22);
  --card-action-hover-fg: rgba(255, 249, 251, 0.98);
  --card-action-hover-bg: rgb(109, 75, 90);
  --card-action-hover-border: rgba(255, 240, 245, 0.32);
}

.result-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.54),
    inset 0 -1px 0 rgba(var(--v-theme-primary), 0.06);
  z-index: 6;
}

.result-card:hover,
.result-card:focus-within {
  transform: translateY(-4px);
  border-color: rgba(var(--v-theme-primary), 0.24);
  box-shadow: var(--shadow-card-depth-hover);
}

.result-action-btn,
.result-link-btn {
  border-radius: var(--search-control-radius);
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.result-action-btn {
  color: var(--card-action-fg) !important;
  background: var(--card-action-bg) !important;
  border: 1px solid var(--card-action-border);
  box-shadow: 0 8px 18px rgba(92, 52, 68, 0.12);
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.result-action-btn :deep(.v-btn__content),
.result-action-btn :deep(.v-icon) {
  color: inherit;
}

.result-action-btn:hover,
.result-action-btn:focus-visible {
  color: var(--card-action-hover-fg) !important;
  background: var(--card-action-hover-bg) !important;
  border-color: var(--card-action-hover-border);
  box-shadow: 0 12px 24px rgba(92, 52, 68, 0.18);
  transform: translateY(-1px);
}

.result-link-btn {
  opacity: var(--card-link-opacity);
  color: var(--card-link-color) !important;
  background: rgba(255, 255, 255, 0.92) !important;
  border: 1px solid rgba(var(--v-theme-secondary), 0.12);
  box-shadow: 0 6px 14px rgba(92, 52, 68, 0.08);
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.result-link-btn:hover,
.result-link-btn:focus-visible {
  background: rgba(255, 255, 255, 0.98) !important;
  border-color: rgba(var(--v-theme-secondary), 0.2);
  box-shadow: 0 10px 20px rgba(92, 52, 68, 0.12);
  transform: translateY(-1px);
}

.card-cover {
  position: relative;
  z-index: 1;
  background: linear-gradient(180deg, rgba(var(--v-theme-accent), 0.1), rgba(var(--v-theme-primary), 0.08));
}

.card-cover--tappable {
  cursor: pointer;
}

.card-cover::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 248px;
  pointer-events: none;
  opacity: 0;
  z-index: 2;
  background:
    linear-gradient(180deg, rgba(255, 247, 250, 0) 0%, rgba(255, 245, 249, 0.035) 12%, rgba(252, 239, 244, 0.12) 28%, rgba(249, 234, 240, 0.3) 48%, rgba(247, 231, 237, 0.48) 72%, rgba(245, 228, 234, 0.64) 100%),
    radial-gradient(circle at 50% 100%, rgba(255, 250, 252, 0.14), transparent 60%);
  transition: opacity 220ms ease;
}

.cover-image {
  position: relative;
  z-index: 1;
}

.cover-image :deep(.v-img__img),
.cover-image :deep(.v-img__picture) {
  transition: filter 220ms ease, opacity 220ms ease, transform 220ms ease;
}

.card-image-blur,
.card-image-wash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: opacity 240ms ease;
}

.card-image-blur {
  opacity: 0.34;
}

.card-image-wash {
  opacity: 0.4;
}

.result-card:hover .card-image-blur,
.result-card:focus-within .card-image-blur {
  opacity: 0.74;
}

.result-card:hover .card-image-wash,
.result-card:focus-within .card-image-wash,
.result-card:hover .card-cover::after,
.result-card:focus-within .card-cover::after {
  opacity: 1;
}

.result-card:hover .cover-image :deep(.v-img__img),
.result-card:focus-within .cover-image :deep(.v-img__img),
.result-card:hover .cover-image :deep(.v-img__picture),
.result-card:focus-within .cover-image :deep(.v-img__picture) {
  -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 64%, rgba(0, 0, 0, 0.92) 74%, rgba(0, 0, 0, 0.62) 86%, rgba(0, 0, 0, 0) 100%);
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 64%, rgba(0, 0, 0, 0.92) 74%, rgba(0, 0, 0, 0.62) 86%, rgba(0, 0, 0, 0) 100%);
}

.card-image-blur {
  z-index: 2;
  background-position: center;
  background-size: cover;
  filter: blur(30px) saturate(0.7) brightness(1.12);
  transform: scale(1.16);
  -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.03) 0%, rgba(0, 0, 0, 0.09) 10%, rgba(0, 0, 0, 0.24) 24%, rgba(0, 0, 0, 0.5) 44%, rgba(0, 0, 0, 0.82) 68%, rgba(0, 0, 0, 1) 100%);
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.03) 0%, rgba(0, 0, 0, 0.09) 10%, rgba(0, 0, 0, 0.24) 24%, rgba(0, 0, 0, 0.5) 44%, rgba(0, 0, 0, 0.82) 68%, rgba(0, 0, 0, 1) 100%);
}

.card-image-wash {
  z-index: 3;
  background: var(--card-image-wash-bg);
  -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.04) 8%, rgba(0, 0, 0, 0.15) 20%, rgba(0, 0, 0, 0.36) 36%, rgba(0, 0, 0, 0.68) 58%, rgba(0, 0, 0, 0.92) 80%, rgba(0, 0, 0, 1) 100%);
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.04) 8%, rgba(0, 0, 0, 0.15) 20%, rgba(0, 0, 0, 0.36) 36%, rgba(0, 0, 0, 0.68) 58%, rgba(0, 0, 0, 0.92) 80%, rgba(0, 0, 0, 1) 100%);
}

.cover-fallback {
  height: 320px;
  display: grid;
  place-items: center;
  color: rgba(31, 45, 51, 0.55);
  background:
    radial-gradient(circle at top, rgba(var(--v-theme-primary), 0.3), transparent 40%),
    linear-gradient(135deg, rgba(var(--v-theme-accent), 0.14), rgba(var(--v-theme-primary), 0.1));
}

.card-body {
  min-height: 252px;
}

.card-hover {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  min-height: 252px;
  padding: 18px 20px 20px;
  overflow: visible;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transform: translateY(calc(100% - 252px));
  transition: transform 240ms ease;
  background: transparent;
}

.card-hover::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: -432px;
  bottom: 0;
  pointer-events: none;
  opacity: 0.42;
  background: var(--card-hover-before-bg);
  backdrop-filter: blur(15px) saturate(0.82) brightness(1.06);
  -webkit-backdrop-filter: blur(15px) saturate(0.82) brightness(1.06);
  -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.025) 10%, rgba(0, 0, 0, 0.1) 22%, rgba(0, 0, 0, 0.26) 38%, rgba(0, 0, 0, 0.56) 60%, rgba(0, 0, 0, 0.88) 82%, rgba(0, 0, 0, 1) 100%);
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.025) 10%, rgba(0, 0, 0, 0.1) 22%, rgba(0, 0, 0, 0.26) 38%, rgba(0, 0, 0, 0.56) 60%, rgba(0, 0, 0, 0.88) 82%, rgba(0, 0, 0, 1) 100%);
  transition: opacity 220ms ease;
}

.card-hover::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 88px;
  pointer-events: none;
  background: var(--card-hover-bg);
  opacity: 0.92;
  -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.14) 20%, rgba(0, 0, 0, 0.42) 40%, rgba(0, 0, 0, 0.74) 64%, rgba(0, 0, 0, 1) 100%);
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.14) 20%, rgba(0, 0, 0, 0.42) 40%, rgba(0, 0, 0, 0.74) 64%, rgba(0, 0, 0, 1) 100%);
}

.card-heading h3 {
  margin: 0;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: 1.2rem;
  line-height: 1.35;
  color: var(--card-title-color);
  text-shadow: var(--card-summary-text-shadow);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.card-heading p {
  margin: 6px 0 0;
  color: var(--card-body-color);
  text-shadow: var(--card-summary-text-shadow);
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  color: var(--card-muted-color);
  font-size: 0.92rem;
  text-shadow: var(--card-summary-text-shadow);
}

.card-meta strong,
.album-name-row strong {
  display: inline-block;
  margin-inline-end: 0.35em;
  color: var(--card-title-color);
  font-weight: 700;
}

.album-name-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 8px;
  color: var(--card-muted-color);
  font-size: 0.86rem;
  text-shadow: var(--card-summary-text-shadow);
}

.card-summary {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 10px;
  min-height: var(--card-summary-min-height);
}

.card-heading {
  height: var(--card-heading-height);
  display: grid;
  align-content: start;
  grid-auto-rows: max-content;
  overflow: hidden;
}

.card-summary--tappable {
  cursor: pointer;
}

.detail-list {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 10px;
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transform: translateY(12px);
  transition: max-height 240ms ease, opacity 180ms ease, transform 240ms ease;
}

.detail-section {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.detail-label {
  font-size: 0.84rem;
  color: rgba(31, 45, 51, 0.62);
  font-weight: 700;
  line-height: 1.7;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.result-card:hover .card-hover,
.result-card:focus-within .card-hover {
  transform: translateY(0);
}

.result-card:hover .card-hover::before,
.result-card:focus-within .card-hover::before {
  opacity: 1;
}

.result-card:hover .card-hover::after,
.result-card:focus-within .card-hover::after {
  opacity: 1;
}

.result-card:hover .detail-list,
.result-card:focus-within .detail-list {
  max-height: 380px;
  opacity: 1;
  transform: translateY(0);
}

@media (max-width: 720px) {
  .result-card {
    --mobile-summary-height: 146px;
    --mobile-card-peek-height: calc(var(--mobile-summary-height) + 26px);
    --mobile-detail-max-height: min(52vh, 360px);
    --mobile-collapse-duration: 280ms;
    --mobile-collapse-easing: cubic-bezier(0.4, 0, 0.2, 1);
    --mobile-expand-duration: 200ms;
    --mobile-expand-easing: cubic-bezier(0.2, 0.9, 0.3, 1);
    --card-summary-min-height: 0;
    --card-heading-height: auto;
    --card-link-color: rgba(31, 45, 51, 0.82);
    --card-link-opacity: 0.78;
    --card-title-color: rgba(31, 45, 51, 0.94);
    --card-body-color: var(--text-soft);
    --card-muted-color: var(--text-muted);
    --card-summary-text-shadow: none;
    --card-action-fg: rgb(var(--v-theme-primary));
    --card-action-bg: rgb(255, 233, 240);
    --card-action-border: rgba(var(--v-theme-primary), 0.18);
    --card-action-hover-fg: rgb(var(--v-theme-primary));
    --card-action-hover-bg: rgb(255, 223, 233);
    --card-action-hover-border: rgba(var(--v-theme-primary), 0.28);
    transform: none;
    transition: border-color 120ms ease;
    box-shadow: none;
  }

  .result-card.tone-dark,
  .result-card.tone-dark:hover,
  .result-card.tone-dark:focus-within,
  .result-card--mobile-expanded.tone-dark,
  .result-card--mobile-expanded.tone-dark:hover,
  .result-card--mobile-expanded.tone-dark:focus-within {
    --card-link-color: rgba(31, 45, 51, 0.82);
    --card-link-opacity: 0.78;
    --card-title-color: rgba(31, 45, 51, 0.94);
    --card-body-color: var(--text-soft);
    --card-muted-color: var(--text-muted);
    --card-summary-text-shadow: none;
    --card-action-fg: rgb(var(--v-theme-primary));
    --card-action-bg: rgb(255, 233, 240);
    --card-action-border: rgba(var(--v-theme-primary), 0.18);
    --card-action-hover-fg: rgb(var(--v-theme-primary));
    --card-action-hover-bg: rgb(255, 223, 233);
    --card-action-hover-border: rgba(var(--v-theme-primary), 0.28);
  }

  .result-card:hover,
  .result-card:focus-within {
    transform: none;
    box-shadow: none;
  }

  .cover-image,
  .cover-fallback {
    height: 216px !important;
  }

  .card-cover {
    background: none;
  }

  .cover-image :deep(.v-img__img),
  .cover-image :deep(.v-img__picture) {
    transition: none;
    -webkit-mask-image: none !important;
    mask-image: none !important;
  }

  .card-cover::after,
  .card-hover::before,
  .card-hover::after {
    display: none;
  }

  .card-image-blur,
  .card-image-wash {
    display: none;
  }

  .card-body {
    min-height: var(--mobile-card-peek-height);
  }

  .card-hover {
    min-height: var(--mobile-card-peek-height);
    max-height: 100%;
    padding: 12px 12px 14px;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    transform: translateY(calc(100% - var(--mobile-card-peek-height)));
    gap: 10px;
    background: rgba(255, 248, 251, 0.9);
    border-top: 1px solid rgba(var(--v-theme-primary), 0.12);
    will-change: transform;
    transition: transform var(--mobile-collapse-duration) var(--mobile-collapse-easing);
  }

  .result-card:hover .card-hover,
  .result-card:focus-within .card-hover {
    transform: translateY(calc(100% - var(--mobile-card-peek-height)));
  }

  .card-summary {
    grid-template-rows: auto;
    min-height: 0;
    gap: 4px;
  }

  .card-heading {
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .card-summary--tappable {
    outline: none;
  }

  .card-heading h3 {
    font-size: 1.08rem;
  }

  .card-heading p {
    margin-top: 4px;
    font-size: 0.95rem;
  }

  .card-meta,
  .album-name-row {
    gap: 4px 8px;
    margin-top: 4px;
    font-size: 0.84rem;
  }

  .card-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .result-action-btn,
  .result-link-btn {
    width: 100%;
    min-width: 0;
    box-shadow: none;
    transition: none;
  }

  .result-action-btn {
    min-height: 38px;
    padding-inline: 10px;
  }

  .result-action-btn :deep(.v-btn__content),
  .result-link-btn :deep(.v-btn__content) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.86rem;
    gap: 4px;
  }

  .result-link-btn {
    padding-inline: 8px;
  }

  .detail-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 10px;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transform: translateY(4px);
    padding-top: 0;
    transition:
      max-height var(--mobile-collapse-duration) var(--mobile-collapse-easing),
      opacity 220ms ease,
      transform var(--mobile-collapse-duration) var(--mobile-collapse-easing),
      margin-top 220ms ease;
  }

  .result-card:hover .detail-list,
  .result-card:focus-within .detail-list {
    max-height: 0;
    opacity: 0;
    transform: translateY(4px);
  }

  .result-card--mobile-expanded .card-hover {
    transform: translateY(0);
    transition-duration: var(--mobile-expand-duration);
    transition-timing-function: var(--mobile-expand-easing);
  }

  .result-card--mobile-expanded .card-hover::before,
  .result-card--mobile-expanded .card-hover::after,
  .result-card--mobile-expanded .card-cover::after,
  .result-card--mobile-expanded .card-image-blur,
  .result-card--mobile-expanded .card-image-wash {
    opacity: 0;
  }

  .result-card--mobile-expanded:hover .card-hover,
  .result-card--mobile-expanded:focus-within .card-hover {
    transform: translateY(0);
  }

  .detail-list--mobile-open {
    max-height: var(--mobile-detail-max-height);
    opacity: 1;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: auto;
    -webkit-overflow-scrolling: touch;
    transform: translateY(0);
    margin-top: 2px;
    padding-inline-end: 2px;
    scrollbar-width: thin;
    transition-duration: var(--mobile-expand-duration), 160ms, var(--mobile-expand-duration), 160ms;
    transition-timing-function: var(--mobile-expand-easing), ease-out, var(--mobile-expand-easing), ease-out;
  }

  .result-card--mobile-expanded:hover .detail-list,
  .result-card--mobile-expanded:focus-within .detail-list,
  .result-card:hover .detail-list--mobile-open,
  .result-card:focus-within .detail-list--mobile-open {
    max-height: var(--mobile-detail-max-height);
    opacity: 1;
    transform: translateY(0);
  }

  .result-action-btn:hover,
  .result-action-btn:focus-visible,
  .result-link-btn:hover,
  .result-link-btn:focus-visible {
    transform: none;
    box-shadow: none;
  }

  .detail-list--mobile-open::-webkit-scrollbar {
    width: 6px;
  }

  .detail-list--mobile-open::-webkit-scrollbar-thumb {
    background: rgba(var(--v-theme-primary), 0.2);
    border-radius: 999px;
  }

  @media (prefers-reduced-motion: reduce) {
    .card-hover,
    .detail-list {
      transition: none;
    }
  }

  .detail-section {
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 6px;
    align-items: start;
  }

  .detail-label {
    font-size: 0.78rem;
    line-height: 1.45;
    letter-spacing: 0.01em;
  }

  .tag-row {
    gap: 4px;
  }
}

@media (max-width: 420px) {
  .cover-image,
  .cover-fallback {
    height: 180px !important;
  }

  .result-card {
    --mobile-card-expanded-max-height: 100%;
  }

  .card-hover {
    padding: 10px 10px 12px;
  }

  .card-actions {
    gap: 5px;
  }

  .result-action-btn {
    padding-inline: 8px;
  }

  .result-action-btn :deep(.v-btn__content),
  .result-link-btn :deep(.v-btn__content) {
    font-size: 0.8rem;
  }

  .detail-list {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .detail-section {
    grid-template-columns: 54px minmax(0, 1fr);
  }
}
</style>
