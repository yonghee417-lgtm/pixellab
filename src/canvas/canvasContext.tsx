import { createContext, useContext } from 'react';
import type { CanvasManager } from './CanvasManager';

export const CanvasManagerContext = createContext<CanvasManager | null>(null);

export function useCanvasManager(): CanvasManager | null {
  return useContext(CanvasManagerContext);
}

export function useRequiredCanvasManager(): CanvasManager {
  const ctx = useContext(CanvasManagerContext);
  if (!ctx) throw new Error('CanvasManager not initialized');
  return ctx;
}
