import { ref } from 'vue';

export type ModalType = 'standards' | 'rules' | null;

export function useGameModal() {
  const activeModal = ref<ModalType>(null);

  function openModal(type: ModalType) {
    activeModal.value = type;
  }

  function closeModal() {
    activeModal.value = null;
  }

  function onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      closeModal();
    }
  }

  return { activeModal, openModal, closeModal, onBackdropClick };
}
