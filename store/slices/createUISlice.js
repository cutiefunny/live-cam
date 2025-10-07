// store/slices/createUISlice.js
export const createUISlice = (set) => ({
  isProfileModalOpen: false,
  isCoinModalOpen: false,
  toast: {
    message: '',
    type: 'info',
    visible: false,
  },
  openProfileModal: () => set({ isProfileModalOpen: true }),
  closeProfileModal: () => set({ isProfileModalOpen: false }),
  openCoinModal: () => set({ isCoinModalOpen: true }),
  closeCoinModal: () => set({ isCoinModalOpen: false }),
  showToast: (message, type = 'info') => set({ toast: { message, type, visible: true } }),
  hideToast: () => set(state => ({ toast: { ...state.toast, visible: false } })),
});