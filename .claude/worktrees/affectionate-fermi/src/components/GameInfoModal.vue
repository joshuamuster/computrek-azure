<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="type"
        class="modal-backdrop"
        @click="onBackdropClick"
        @keydown.esc="$emit('close')"
        tabindex="-1"
      >
        <div class="modal-panel" role="dialog" :aria-label="type === 'standards' ? 'Curriculum Standards' : 'Rules of the Game'">
          <div class="modal-header">
            <h2 class="modal-title">{{ type === 'standards' ? 'Curriculum Standards' : 'Rules of the Game' }}</h2>
            <button class="modal-close" @click="$emit('close')" aria-label="Close">&#10005;</button>
          </div>

          <div class="modal-body">
            <p class="modal-intro">{{ data?.intro }}</p>
            <ul class="modal-list">
              <li v-for="item in data?.items" :key="item.code">
                <span>{{ item.code }}</span> &mdash; {{ item.text }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface InfoItem {
  code: string;
  text: string;
}

interface InfoData {
  intro: string;
  items: InfoItem[];
}

const props = defineProps<{
  type: 'standards' | 'rules' | null;
  data: InfoData | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

function onBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
    emit('close');
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(0.375rem);
  -webkit-backdrop-filter: blur(0.375rem);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  padding: 1.5rem;
}

.modal-panel {
  background: rgba(8, 15, 28, 0.97);
  border: 0.0625rem solid rgba(153, 204, 255, 0.3);
  border-radius: 1rem;
  box-shadow: 0 0 3rem rgba(153, 204, 255, 0.1), 0 0 0.5rem rgba(0, 0, 0, 0.8);
  width: 100%;
  max-width: 46rem;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.75rem;
  border-bottom: 0.0625rem solid rgba(153, 204, 255, 0.2);
  flex-shrink: 0;
}

.modal-title {
  font-family: 'Antonio', sans-serif;
  font-size: 1.5rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  color: var(--theme-color, #99ccff);
  margin: 0;
}

.modal-close {
  background: transparent;
  border: 0.0625rem solid rgba(153, 204, 255, 0.3);
  border-radius: 50%;
  color: rgba(153, 204, 255, 0.7);
  cursor: pointer;
  font-size: 0.9rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.modal-close:hover {
  background: rgba(153, 204, 255, 0.15);
  border-color: #99ccff;
  color: #fff;
}

.modal-body {
  padding: 1.5rem 1.75rem;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(153, 204, 255, 0.3) transparent;
}

.modal-body::-webkit-scrollbar {
  width: 0.375rem;
}

.modal-body::-webkit-scrollbar-track {
  background: transparent;
}

.modal-body::-webkit-scrollbar-thumb {
  background: rgba(153, 204, 255, 0.3);
  border-radius: 0.25rem;
}

.modal-intro {
  font-family: 'Roboto', sans-serif;
  color: #c8d8e8;
  font-size: 1rem;
  line-height: 1.7;
  margin-bottom: 1.5rem;
  border-left: 0.25rem solid var(--theme-color, #99ccff);
  padding-left: 1rem;
}

.modal-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.modal-list li {
  font-family: 'Roboto', sans-serif;
  color: #b0c4d8;
  font-size: 0.95rem;
  line-height: 1.6;
  padding: 0.75rem 1rem;
  background: rgba(153, 204, 255, 0.04);
  border-radius: 0.5rem;
  border: 0.0625rem solid rgba(153, 204, 255, 0.1);
}

.modal-list li span {
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  color: var(--champsyellow);
  font-weight: 700;
  letter-spacing: 0.03rem;
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(1rem) scale(0.98);
}
</style>
