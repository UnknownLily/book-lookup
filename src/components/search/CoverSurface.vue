<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { detectCoverTone } from '../../utils/coverTone'

type CoverState = 'loading' | 'loaded' | 'error' | 'empty'

const props = defineProps<{
  src: string | null
  alt: string
  title: string
  variant: 'card' | 'list'
}>()

const emit = defineEmits<{
  toneChange: [isDark: boolean]
}>()

const { t } = useI18n()

const coverState = ref<CoverState>(props.src ? 'loading' : 'empty')
const sakuraPlaceholderSrc = '/sakura-flower-dashed.svg'
let toneToken = 0

const statusLabel = computed(() => {
  if (coverState.value === 'loading') {
    return props.alt
  }

  if (coverState.value === 'error') {
    return t('app.coverLoadFailed')
  }

  if (coverState.value === 'empty') {
    return t('app.noCover')
  }

  return props.alt
})

const isEmptyState = computed(() => coverState.value === 'empty')

const placeholderText = computed(() => {
  if (coverState.value === 'error') {
    return t('app.coverLoadFailed')
  }

  return t('app.noCover')
})

watch(
  () => props.src,
  (src) => {
    toneToken += 1
    const currentToken = toneToken
    emit('toneChange', false)

    if (!src) {
      coverState.value = 'empty'
      return
    }

    coverState.value = 'loading'
    void refreshTone(src, currentToken)
  },
  { immediate: true },
)

async function refreshTone(src: string, currentToken: number): Promise<void> {
  const isDark = await detectCoverTone(src)

  if (currentToken !== toneToken || coverState.value === 'error') {
    return
  }

  emit('toneChange', isDark)
}

function handleLoad(): void {
  coverState.value = 'loaded'
}

function handleError(): void {
  toneToken += 1
  coverState.value = props.src ? 'error' : 'empty'
  emit('toneChange', false)
}
</script>

<template>
  <div
    class="cover-surface"
    :class="[`cover-surface--${variant}`, `cover-surface--${coverState}`]"
    :aria-busy="coverState === 'loading'"
    :aria-label="statusLabel"
  >
    <div class="cover-surface__base" aria-hidden="true">
      <div class="cover-surface__grain" />
      <div class="cover-surface__halo" />
    </div>

    <v-img
      v-if="src"
      :src="src"
      :alt="alt"
      :cover="variant === 'card'"
      class="cover-surface__image"
      @load="handleLoad"
      @error="handleError"
    />

    <transition name="cover-surface-fade">
      <div v-if="coverState !== 'loaded'" class="cover-surface__placeholder" :class="{ 'cover-surface__placeholder--loading': coverState === 'loading' }" aria-hidden="true">
        <div v-if="coverState === 'loading'" class="cover-surface__loading-wash" />
        <transition v-else name="cover-surface-state" mode="out-in">
          <div :key="coverState" class="cover-surface__status">
            <div class="cover-surface__glow" />
            <img
              v-if="isEmptyState"
              class="cover-surface__flower"
              :class="{ 'cover-surface__flower--list': variant === 'list' }"
              :src="sakuraPlaceholderSrc"
              alt=""
            >
            <v-icon v-else class="cover-surface__icon" icon="$coverMissing" :size="variant === 'card' ? 58 : 42" />
            <span class="cover-surface__label">{{ placeholderText }}</span>
          </div>
        </transition>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.cover-surface {
  position: relative;
  width: 100%;
  overflow: hidden;
  isolation: isolate;
  border-radius: inherit;
  background:
    radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.78), transparent 24%),
    radial-gradient(circle at 82% 18%, rgba(var(--v-theme-primary), 0.12), transparent 28%),
    linear-gradient(145deg, rgba(255, 251, 252, 0.98) 0%, rgba(249, 241, 245, 0.95) 50%, rgba(244, 233, 239, 0.94) 100%);
}

.cover-surface--card {
  height: 320px;
}

.cover-surface--list {
  height: 156px;
  max-width: 168px;
}

.cover-surface__base,
.cover-surface__placeholder,
.cover-surface__image {
  position: absolute;
  inset: 0;
}

.cover-surface__base {
  z-index: 0;
}

.cover-surface__grain,
.cover-surface__halo {
  position: absolute;
  inset: 0;
}

.cover-surface__grain {
  opacity: 0.34;
  background:
    repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0 3px, rgba(244, 235, 240, 0.08) 3px 6px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0));
  mix-blend-mode: screen;
}

.cover-surface__halo {
  background:
    radial-gradient(circle at 50% 38%, rgba(var(--v-theme-primary), 0.14), transparent 34%),
    radial-gradient(circle at 50% 100%, rgba(var(--v-theme-secondary), 0.12), transparent 44%);
}

.cover-surface__image {
  z-index: 1;
  opacity: 0;
  transform: scale(1.018);
  filter: saturate(0.94) brightness(1.02);
  transition: opacity 280ms ease, transform 320ms ease, filter 320ms ease;
}

.cover-surface--loaded .cover-surface__image {
  opacity: 1;
  transform: scale(1);
  filter: none;
}

.cover-surface__image :deep(.v-responsive__content) {
  display: none;
}

.cover-surface--card .cover-surface__image :deep(.v-img__img),
.cover-surface--card .cover-surface__image :deep(.v-img__picture) {
  object-fit: cover;
}

.cover-surface--list .cover-surface__image :deep(.v-img__img),
.cover-surface--list .cover-surface__image :deep(.v-img__picture) {
  object-fit: contain;
  padding: 10px 6px;
}

.cover-surface__placeholder {
  z-index: 2;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 12px;
  padding: 20px;
  background: linear-gradient(180deg, rgba(255, 250, 252, 0.5), rgba(248, 240, 244, 0.74));
}

.cover-surface__placeholder--loading {
  background:
    linear-gradient(180deg, rgba(255, 250, 252, 0.38), rgba(248, 240, 244, 0.6)),
    radial-gradient(circle at 50% 44%, rgba(var(--v-theme-primary), 0.08), transparent 34%);
}

.cover-surface__status {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 12px;
  width: 100%;
  height: 100%;
}

.cover-surface__placeholder::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(125deg, rgba(255, 255, 255, 0) 22%, rgba(255, 255, 255, 0.42) 50%, rgba(255, 255, 255, 0) 78%);
  opacity: 0;
  transform: translateX(-120%);
  pointer-events: none;
}

.cover-surface__loading-wash {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02)),
    radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.3), transparent 28%);
  animation: cover-surface-loading-breathe 2.2s ease-in-out infinite;
}

.cover-surface__glow {
  position: absolute;
  width: 42%;
  aspect-ratio: 1;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(var(--v-theme-primary), 0.18), rgba(var(--v-theme-primary), 0.04) 58%, transparent 78%);
  filter: blur(12px);
}

.cover-surface__icon {
  position: relative;
  z-index: 1;
  color: rgba(128, 76, 94, 0.76);
  filter: drop-shadow(0 10px 18px rgba(255, 255, 255, 0.4));
}

.cover-surface__flower {
  position: relative;
  z-index: 1;
  width: min(112px, 48%);
  max-width: 112px;
  opacity: 0.94;
  filter: drop-shadow(0 14px 24px rgba(245, 150, 170, 0.18));
}

.cover-surface__flower--list {
  width: min(82px, 54%);
}

.cover-surface__label {
  position: relative;
  z-index: 1;
  color: rgba(92, 57, 70, 0.78);
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  text-align: center;
}

.cover-surface--loading .cover-surface__placeholder::after {
  opacity: 1;
  animation: cover-surface-shimmer 1.7s ease-in-out infinite;
}

.cover-surface--list .cover-surface__placeholder {
  gap: 8px;
  padding: 12px;
}

.cover-surface--list .cover-surface__status {
  gap: 8px;
}

.cover-surface--list .cover-surface__label {
  font-size: 0.72rem;
}

.cover-surface-fade-enter-active,
.cover-surface-fade-leave-active {
  transition: opacity 240ms ease, transform 260ms ease, filter 260ms ease;
}

.cover-surface-fade-enter-from,
.cover-surface-fade-leave-to {
  opacity: 0;
  transform: scale(0.985);
  filter: blur(3px);
}

.cover-surface-state-enter-active,
.cover-surface-state-leave-active {
  transition: opacity 180ms ease, transform 220ms ease;
}

.cover-surface-state-enter-from,
.cover-surface-state-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

@keyframes cover-surface-shimmer {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(120%);
  }
}

@keyframes cover-surface-pulse {
  0%,
  100% {
    opacity: 0.72;
    transform: scale(0.98);
  }

  50% {
    opacity: 0.96;
    transform: scale(1.04);
  }
}

@keyframes cover-surface-loading-breathe {
  0%,
  100% {
    opacity: 0.72;
    transform: scale(0.995);
  }

  50% {
    opacity: 1;
    transform: scale(1.01);
  }
}

@media (max-width: 720px) {
  .cover-surface--card {
    height: 216px;
  }

  .cover-surface--list {
    height: 144px;
    max-width: 152px;
  }
}

@media (max-width: 480px) {
  .cover-surface--list {
    height: 132px;
    max-width: 136px;
  }
}

@media (max-width: 420px) {
  .cover-surface--card {
    height: 180px;
  }
}
</style>
