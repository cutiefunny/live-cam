// store/useAppStore.js
import { create } from 'zustand';

const useAppStore = create((set) => ({
  // 온라인 크리에이터 목록
  creators: [],
  setCreators: (creators) => set({ creators }),

  // 통화 요청 정보
  callRequest: null,
  setCallRequest: (callRequest) => set({ callRequest }),
  
  // ✨ [추가] 팝콘 메시지(Toast) 상태
  toast: {
    message: '',
    type: 'info', // 'info', 'success', 'error'
    visible: false,
  },
  showToast: (message, type = 'info') => set({ toast: { message, type, visible: true } }),
  hideToast: () => set(state => ({ toast: { ...state.toast, visible: false } })),
}));

export default useAppStore;