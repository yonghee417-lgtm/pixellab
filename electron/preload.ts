import { contextBridge, ipcRenderer } from 'electron';
import type { Project } from '../shared/types';

const api = {
  // 다이얼로그
  openImageDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:openImage'),
  saveExportDialog: (defaultName: string, ext: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveExport', defaultName, ext),

  // 파일
  fileExists: (filePath: string): Promise<boolean> => ipcRenderer.invoke('file:exists', filePath),
  readImageDataUrl: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('file:readImageDataUrl', filePath),
  writeBuffer: (filePath: string, base64: string): Promise<string> =>
    ipcRenderer.invoke('export:writeBuffer', filePath, base64),

  // 프로젝트
  saveProject: (project: Project): Promise<string> => ipcRenderer.invoke('project:save', project),
  saveProjectToPath: (project: Project, filePath: string): Promise<string> =>
    ipcRenderer.invoke('project:saveToPath', project, filePath),
  saveProjectAs: (project: Project, defaultName?: string): Promise<string | null> =>
    ipcRenderer.invoke('project:saveAs', project, defaultName),
  openProjectFile: (): Promise<{ project: Project; filePath: string } | { error: string } | null> =>
    ipcRenderer.invoke('project:openFile'),
  openProjectFromPath: (filePath: string): Promise<{ project: Project; filePath: string } | { error: string }> =>
    ipcRenderer.invoke('project:openFromPath', filePath),
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('project:list'),
  deleteProject: (id: string): Promise<boolean> => ipcRenderer.invoke('project:delete', id),
  libraryPath: (): Promise<string> => ipcRenderer.invoke('project:libraryPath'),

  // 폰트
  listFonts: (): Promise<{ family: string; path: string; fileName: string }[]> =>
    ipcRenderer.invoke('fonts:list'),
  fontsDir: (): Promise<string> => ipcRenderer.invoke('fonts:dir'),

  // 미디어 URL 변환 (절대 경로 → pixellab-media://)
  toMediaUrl: (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/');
    const encoded = normalized.split('/').map((seg) => encodeURIComponent(seg)).join('/');
    return `pixellab-media://local/${encoded}`;
  },
};

contextBridge.exposeInMainWorld('api', api);

export type PixelLabApi = typeof api;
