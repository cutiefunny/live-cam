// store/slices/createAuthSlice.js
export const createAuthSlice = (set) => ({
  user: null,
  isCreator: false,
  isAuthLoading: true,
  userGender: null, // ✨ [추가]
  setUser: (user) => set({ user }),
  setIsCreator: (isCreator) => set({ isCreator }),
  setIsAuthLoading: (isLoading) => set({ isAuthLoading: isLoading }),
  setUserGender: (gender) => set({ userGender: gender }), // ✨ [추가]
});
