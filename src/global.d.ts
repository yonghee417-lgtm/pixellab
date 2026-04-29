import type { PixelLabApi } from '../electron/preload';

declare global {
  interface Window {
    api: PixelLabApi;
  }
  // package.json에서 자동 주입되는 앱 버전
  const __APP_VERSION__: string;
}

export {};
