// store/slices/createAuthSlice.js
export const createAuthSlice = (set) => ({
  user: null,
  isCreator: false,
  isAuthLoading: true,
  setUser: (user) => set({ user }),
  setIsCreator: (isCreator) => set({ isCreator }),
  setIsAuthLoading: (isLoading) => set({ isAuthLoading: isLoading }),
});