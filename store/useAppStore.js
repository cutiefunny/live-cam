// store/useAppStore.js
import { create } from 'zustand';

const useAppStore = create((set) => ({
  // 온라인 크리에이터 목록을 저장하는 상태
  creators: [],
  setCreators: (creators) => set({ creators }),

  // 크리에이터에게 들어온 통화 요청 정보를 저장하는 상태
  callRequest: null,
  setCallRequest: (callRequest) => set({ callRequest }),

  // 로그 저장을 위한 상태 추가
  logs: [],
  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  clearLogs: () => set({ logs: [] }),
}));

export default useAppStore;