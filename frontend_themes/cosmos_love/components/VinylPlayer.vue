<template>
  <div class="vinyl-player" :class="{ playing: isPlaying }">
    <div class="vinyl-disc" @click="togglePlay">
      <div class="disc-grooves">
        <div class="groove" v-for="i in 6" :key="i" :style="{ width: (i * 14 + 20) + '%', height: (i * 14 + 20) + '%' }"></div>
      </div>
      <div class="disc-label">
        <span class="label-text">{{ title || '♪' }}</span>
      </div>
      <div class="disc-highlight"></div>
    </div>
    <div class="vinyl-arm" :class="{ down: isPlaying }">
      <div class="arm-base"></div>
      <div class="arm-stick"></div>
      <div class="arm-head"></div>
    </div>
    <div class="vinyl-info" v-if="title">
      <div class="track-title">{{ title }}</div>
    </div>
    <audio ref="audioRef" :src="src" @ended="onEnded" preload="metadata"></audio>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  src: string;
  title?: string;
}>();

const audioRef = ref<HTMLAudioElement>();
const isPlaying = ref(false);

const togglePlay = async () => {
  if (!audioRef.value) return;
  if (isPlaying.value) {
    audioRef.value.pause();
    isPlaying.value = false;
  } else {
    try {
      await audioRef.value.play();
      isPlaying.value = true;
    } catch {
      // Browser may block autoplay
    }
  }
};

const onEnded = () => {
  isPlaying.value = false;
};

defineExpose({ togglePlay });
</script>

<style scoped>
.vinyl-player {
  position: relative;
  width: 200px;
  height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vinyl-disc {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: radial-gradient(circle, #1a1a2e 18%, #111 19%, #1a1a2e 20%, #111 40%, #1a1a2e 41%, #111 60%, #1a1a2e 61%, #111 80%, #1a1a2e 81%, #111 100%);
  position: relative;
  cursor: pointer;
  transition: transform 0.3s;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.vinyl-disc:hover {
  transform: scale(1.02);
}

.playing .vinyl-disc {
  animation: spin 3s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.disc-grooves {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
}

.groove {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.disc-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 36%;
  height: 36%;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-rose), var(--accent-lavender));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 15px rgba(255, 107, 157, 0.3);
}

.label-text {
  font-size: 0.7rem;
  color: #fff;
  font-weight: 600;
  text-align: center;
  max-width: 80%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.disc-highlight {
  position: absolute;
  top: 10%;
  left: 15%;
  width: 30%;
  height: 15%;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  transform: rotate(-30deg);
}

.vinyl-arm {
  position: absolute;
  top: 8px;
  right: 25px;
  transform-origin: 85% 8%;
  transition: transform 0.5s ease;
  transform: rotate(-25deg);
  z-index: 2;
}

.vinyl-arm.down {
  transform: rotate(0deg);
}

.arm-base {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #888;
  position: absolute;
  right: 0;
  top: 0;
}

.arm-stick {
  width: 4px;
  height: 70px;
  background: linear-gradient(to bottom, #aaa, #888);
  position: absolute;
  right: 6px;
  top: 8px;
  border-radius: 2px;
  transform: rotate(15deg);
  transform-origin: top center;
}

.arm-head {
  width: 8px;
  height: 12px;
  background: #999;
  position: absolute;
  right: 22px;
  top: 68px;
  border-radius: 0 0 2px 2px;
  transform: rotate(15deg);
}

.vinyl-info {
  margin-top: 12px;
  text-align: center;
}

.track-title {
  font-family: var(--font-display);
  font-size: 0.95rem;
  color: var(--ink-soft);
  font-weight: 600;
}
</style>
