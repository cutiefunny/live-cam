// store/slices/createUISlice.js
export const createUISlice = (set) => ({
  isProfileModalOpen: false,
  isCoinModalOpen: false,
  isRatingModalOpen: false, // ✨ [추가]
  ratingModalData: null, // ✨ [추가]
  toast: {
    message: '',
    type: 'info',
    visible: false,
  },
  openProfileModal: () => set({ isProfileModalOpen: true }),
  closeProfileModal: () => set({ isProfileModalOpen: false }),
  openCoinModal: () => set({ isCoinModalOpen: true }),
  closeCoinModal: () => set({ isCoinModalOpen: false }),
  openRatingModal: (data) => set({ isRatingModalOpen: true, ratingModalData: data }), // ✨ [추가]
  closeRatingModal: () => set({ isRatingModalOpen: false, ratingModalData: null }), // ✨ [추가]
  showToast: (message, type = 'info') => set({ toast: { message, type, visible: true } }),
  hideToast: () => set(state => ({ toast: { ...state.toast, visible: false } })),
});