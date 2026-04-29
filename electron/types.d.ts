import type { PixelLabApi } from './preload';

declare global {
  interface Window {
    api: PixelLabApi;
  }
}
