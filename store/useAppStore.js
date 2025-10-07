// store/useAppStore.js
import { create } from 'zustand';
import { createAuthSlice } from './slices/createAuthSlice';
import { createDataSlice } from './slices/createDataSlice';
import { createUISlice } from './slices/createUISlice';

const useAppStore = create((...a) => ({
  ...createAuthSlice(...a),
  ...createDataSlice(...a),
  ...createUISlice(...a),
}));

export default useAppStore;