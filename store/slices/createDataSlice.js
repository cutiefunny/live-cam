// store/slices/createDataSlice.js
export const createDataSlice = (set) => ({
  creators: [],
  callRequest: null,
  userCoins: 0,
  settings: null,
  isLoadingSettings: true,
  giftAnimation: null, // ✨ [추가]
  setCreators: (creators) => set({ creators }),
  setCallRequest: (callRequest) => set({ callRequest }),
  setUserCoins: (userCoins) => set({ userCoins }),
  setSettings: (settings) => set({ settings }),
  setIsLoadingSettings: (isLoading) => set({ isLoadingSettings: isLoading }),
  setGiftAnimation: (gift) => set({ giftAnimation: gift }), // ✨ [추가]
});