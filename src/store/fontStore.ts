import { create } from 'zustand';
import type { FontInfo } from '@shared/types';

interface FontState {
  fonts: FontInfo[];
  setFonts: (fonts: FontInfo[]) => void;
}

export const useFontStore = create<FontState>((set) => ({
  fonts: [],
  setFonts: (fonts) => set({ fonts }),
}));
