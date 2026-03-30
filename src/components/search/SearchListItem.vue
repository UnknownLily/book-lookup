<script setup lang="ts">
import { ref, watch } from 'vue'
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

const isDarkCover = ref(false)
let toneAnalysisToken = 0

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
  <v-card class="list-item" :class="{ 'tone-dark': isDarkCover }" variant="flat">
    <div class="list-cover">
      <div
        v-if="item.coverUrl"
        class="list-cover-art"
        :style="{
          backgroundImage: `url(${item.coverUrl})`,
        }"
        aria-hidden="true"
      />
      <div class="list-cover-wash" aria-hidden="true" />

      <div v-if="item.coverUrl" class="list-cover-frame">
        <v-img :src="item.coverUrl" :alt="item.title" class="list-cover-image" contain height="156" />
      </div>
      <div v-else class="list-cover-fallback">{{ t('app.noCover') }}</div>
    </div>

    <div class="list-body">
      <div
        v-if="item.coverUrl"
        class="list-body-art"
        :style="{
          backgroundImage: `url(${item.coverUrl})`,
        }"
        aria-hidden="true"
      />
      <div class="list-body-wash" aria-hidden="true" />

      <div class="list-body-content">
        <div class="list-summary">
          <div class="list-header">
            <div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.subtitle }}</p>
              <div v-if="item.secondaryNames.length > 0" class="list-album-names">
                <span v-for="secondaryName in item.secondaryNames.slice(0, 3)" :key="secondaryName">
                  <strong>{{ t('app.aliasPrefix') }}</strong>{{ secondaryName }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="item.meta.length > 0" class="list-meta">
            <span v-for="line in item.meta" :key="line">
              <template v-for="part in [splitMetaLine(line)]" :key="part.label + part.value">
                <strong>{{ part.label }}</strong><span v-if="part.value"> {{ part.value }}</span>
              </template>
            </span>
          </div>

          <div v-if="item.wikiUrl || item.links.length > 0" class="list-links">
            <v-btn
              class="result-action-btn"
              color="primary"
              variant="tonal"
              append-icon="$externalLink"
              :href="item.wikiUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t('app.wikiAction') }}
            </v-btn>

            <v-btn
              class="result-link-btn"
              v-for="link in item.links.slice(0, 2)"
              :key="link.key"
              size="small"
              variant="tonal"
              color="secondary"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ link.label }}
            </v-btn>
          </div>
        </div>

        <div class="dense-sections">
          <div v-for="section in item.detailSections.slice(0, 8)" :key="section.key" class="dense-section">
            <strong>{{ getFieldLabel(section.key) }}</strong>
            <div class="dense-tags">
              <TagActionMenu
                v-for="tag in section.tags.slice(0, 4)"
                :key="`${item.id}-${tag.field}-${tag.value}`"
                :tag="tag"
                compact
                @add="emit('addTag', $event)"
                @set="emit('setTag', $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </v-card>
</template>

<style scoped>
.list-item {
  --list-cover-wash:
    radial-gradient(circle at 50% 16%, rgba(255, 255, 255, 0.34), transparent 40%),
    radial-gradient(circle at 20% 74%, rgba(255, 250, 252, 0.08), transparent 46%),
    linear-gradient(180deg, rgba(255, 250, 252, 0.24) 0%, rgba(255, 247, 250, 0.08) 46%, rgba(255, 243, 247, 0.2) 100%);
  --list-body-wash:
    radial-gradient(circle at 84% 18%, rgba(255, 255, 255, 0.16), transparent 24%),
    radial-gradient(circle at 72% 62%, rgba(255, 255, 255, 0.12), transparent 32%),
    linear-gradient(90deg, rgba(255, 252, 253, 0.9) 0%, rgba(255, 250, 251, 0.82) 30%, rgba(255, 247, 249, 0.56) 62%, rgba(255, 244, 247, 0.3) 100%);
  display: grid;
  grid-template-columns: 188px minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--theme-border-soft);
  background: linear-gradient(135deg, rgba(255, 251, 252, 0.98) 0%, rgba(251, 244, 247, 0.95) 48%, rgba(247, 239, 243, 0.92) 100%);
  box-shadow: var(--shadow-soft);
  transition:
    transform 220ms ease,
    box-shadow 220ms ease,
    border-color 220ms ease;
  position: relative;
}

.list-item.tone-dark {
  --list-cover-wash:
    radial-gradient(circle at 50% 16%, rgba(255, 255, 255, 0.42), transparent 38%),
    radial-gradient(circle at 26% 74%, rgba(255, 248, 250, 0.12), transparent 44%),
    linear-gradient(180deg, rgba(255, 250, 252, 0.36) 0%, rgba(255, 246, 249, 0.14) 48%, rgba(255, 241, 246, 0.3) 100%);
  --list-body-wash:
    radial-gradient(circle at 84% 18%, rgba(255, 255, 255, 0.2), transparent 24%),
    radial-gradient(circle at 72% 62%, rgba(255, 252, 253, 0.14), transparent 32%),
    linear-gradient(90deg, rgba(255, 252, 253, 0.92) 0%, rgba(255, 249, 251, 0.84) 30%, rgba(255, 245, 248, 0.6) 62%, rgba(255, 242, 246, 0.34) 100%);
}

.list-item::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.48),
    inset 0 -1px 0 rgba(var(--v-theme-primary), 0.05);
}

.list-item:hover,
.list-item:focus-within {
  transform: translateY(-2px);
  border-color: rgba(var(--v-theme-primary), 0.22);
  box-shadow:
    0 16px 30px rgba(56, 44, 34, 0.09),
    0 28px 48px rgba(56, 44, 34, 0.07),
    0 2px 6px rgba(255, 255, 255, 0.42) inset;
}

.list-item:hover .list-cover-art,
.list-item:focus-within .list-cover-art {
  opacity: 0.88;
  filter: blur(34px) saturate(1.34);
  transform: scale(1.22);
}

.list-item.tone-dark .list-cover-art {
  opacity: 0.8;
  filter: blur(32px) saturate(1.34);
}

.list-item.tone-dark:hover .list-cover-art,
.list-item.tone-dark:focus-within .list-cover-art {
  opacity: 0.94;
  filter: blur(36px) saturate(1.42);
}

.list-item:hover .list-body-art,
.list-item:focus-within .list-body-art {
  inset: -22% -8% -22% 36%;
  background-position: 44% center;
  opacity: 0.6;
  filter: blur(38px) saturate(0.72) brightness(1.14);
  transform: translateX(-12px) scale(1.26);
}

.list-item:hover .list-body-wash,
.list-item:focus-within .list-body-wash {
  opacity: 1;
}

.list-item.tone-dark:hover .list-body-art,
.list-item.tone-dark:focus-within .list-body-art {
  inset: -22% -8% -22% 34%;
  background-position: 42% center;
  opacity: 0.64;
  filter: blur(40px) saturate(0.78) brightness(1.12);
  transform: translateX(-16px) scale(1.28);
}

.result-action-btn,
.result-link-btn {
  border-radius: var(--search-control-radius);
}

.result-action-btn {
  color: rgb(var(--v-theme-primary)) !important;
  background: rgb(255, 233, 240) !important;
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  box-shadow: 0 8px 18px rgba(92, 52, 68, 0.12);
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.result-action-btn:hover,
.result-action-btn:focus-visible {
  background: rgb(255, 223, 233) !important;
  border-color: rgba(var(--v-theme-primary), 0.28);
  box-shadow: 0 12px 24px rgba(92, 52, 68, 0.18);
  transform: translateY(-1px);
}

.result-action-btn :deep(.v-btn__content),
.result-action-btn :deep(.v-icon) {
  color: inherit;
}

.result-link-btn {
  opacity: 0.78;
  color: rgba(31, 45, 51, 0.82) !important;
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

.list-cover {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: grid;
  place-items: center;
  padding: 16px 10px;
  background: linear-gradient(180deg, rgba(255, 249, 251, 0.92), rgba(250, 242, 246, 0.76));
}

.list-cover-art {
  position: absolute;
  inset: -16% -10% -14% -10%;
  background-position: center;
  background-size: cover;
  opacity: 0.82;
  filter: blur(32px) saturate(1.22);
  transform: scale(1.18);
  transition:
    opacity 220ms ease,
    filter 240ms ease,
    transform 240ms ease;
}

.list-cover-wash {
  position: absolute;
  inset: 0;
  background: var(--list-cover-wash);
}

.list-cover-frame {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  min-height: 156px;
  display: grid;
  place-items: center;
}

.list-cover-image {
  width: 100%;
  max-width: 168px;
}

.list-cover-fallback {
  height: 100%;
  min-height: 156px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
}

.list-body {
  position: relative;
  overflow: hidden;
  padding: 18px 20px;
  display: grid;
  gap: 14px;
  isolation: isolate;
}

.list-body-content {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
  gap: 18px 26px;
  align-items: start;
}

.list-summary {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.list-body-art {
  position: absolute;
  inset: -18% -4% -18% 52%;
  background-position: 56% center;
  background-size: cover;
  opacity: 0.5;
  filter: blur(34px) saturate(0.62) brightness(1.16);
  transform: translateX(0) scale(1.16);
  transition:
    background-position 280ms ease,
    inset 260ms ease,
    opacity 240ms ease,
    filter 260ms ease,
    transform 260ms ease;
}

.list-body-wash {
  position: absolute;
  inset: 0;
  opacity: 0.9;
  background: var(--list-body-wash);
  transition: opacity 220ms ease;
}

.list-header {
  display: grid;
  gap: 0;
}

.list-header h3 {
  margin: 0;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: 1.16rem;
  line-height: 1.35;
}

.list-header p {
    gap: 0;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: var(--text-muted);
  font-size: 0.92rem;
}

.list-meta strong,
.list-album-names strong {
  display: inline-block;
  margin-inline-end: 0.35em;
  color: var(--text-strong);
  font-weight: 700;
}

.list-album-names {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  margin-top: 10px;
  color: var(--text-muted);
  font-size: 0.86rem;
}

.dense-tags,
.list-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dense-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 18px;
  align-content: start;
}

.dense-section {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.dense-section strong {
  color: var(--text-soft);
  font-size: 0.86rem;
  line-height: 1.75;
}

.dense-tags {
  gap: 6px;
}

@media (max-width: 860px) {
  .list-item {
    grid-template-columns: 168px minmax(0, 1fr);
  }

  .list-body-content {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .dense-sections {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
}

@media (max-width: 720px) {
  .dense-sections {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}

@media (max-width: 720px) {
  .list-item {
    grid-template-columns: 1fr;
    transition: border-color 120ms ease;
    box-shadow: none;
  }

  .list-item:hover,
  .list-item:focus-within {
    transform: none;
    box-shadow: none;
  }

  .list-cover {
    padding: 16px 16px 0;
  }

  .list-cover-frame,
  .list-cover-fallback {
    min-height: 144px;
  }

  .list-cover-image {
    max-width: 152px;
  }

  .list-body {
    padding: 12px 14px 14px;
  }

  .list-header {
    flex-direction: column;
    gap: 8px;
  }

  .list-header .result-action-btn {
    align-self: flex-start;
    min-height: 40px;
  }

  .list-body-art {
    inset: 44% -8% -10% -8%;
    opacity: 0.18;
    filter: none;
    transform: none;
    transition: none;
  }

  .list-cover-art {
    filter: none;
    transform: none;
    opacity: 0;
    transition: none;
  }

  .list-cover-wash,
  .list-body-wash,
  .list-body-art {
    display: none;
  }

  .list-item:hover .list-cover-art,
  .list-item:focus-within .list-cover-art,
  .list-item.tone-dark .list-cover-art,
  .list-item.tone-dark:hover .list-cover-art,
  .list-item.tone-dark:focus-within .list-cover-art {
    filter: none;
    transform: none;
    opacity: 0;
  }

  .list-item:hover .list-body-art,
  .list-item:focus-within .list-body-art,
  .list-item.tone-dark:hover .list-body-art,
  .list-item.tone-dark:focus-within .list-body-art {
    inset: 44% -8% -10% -8%;
    background-position: 56% center;
    filter: none;
    transform: none;
    opacity: 0;
  }

  .list-meta,
  .list-album-names {
    gap: 4px 8px;
    font-size: 0.84rem;
  }

  .list-links {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .list-links .result-link-btn {
    width: auto;
  }

  .dense-section {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 6px;
  }

  .dense-section strong {
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .dense-tags {
    gap: 4px;
  }
}

@media (max-width: 480px) {
  .list-cover {
    padding: 14px 14px 0;
  }

  .list-cover-frame,
  .list-cover-fallback {
    min-height: 132px;
  }

  .list-cover-image {
    max-width: 136px;
  }

  .list-body {
    padding: 10px 12px 12px;
  }

  .list-header h3 {
    font-size: 1.05rem;
  }

  .list-links {
    gap: 5px;
  }

  .dense-section {
    grid-template-columns: 58px minmax(0, 1fr);
  }
}
</style>
