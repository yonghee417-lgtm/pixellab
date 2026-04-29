// 외부에서 열린 .pxlab 파일 경로를 localStorage에 저장 (라이브러리 외 파일들의 최근 목록)
export interface RecentExternalFile {
  filePath: string;
  name: string;
  width: number;
  height: number;
  lastOpened: number;
}

const KEY = 'pixellab.recentExternal';
const MAX = 30;

export function getRecentExternal(): RecentExternalFile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentExternalFile[];
  } catch {
    return [];
  }
}

export function addRecentExternal(entry: RecentExternalFile) {
  const list = getRecentExternal().filter((e) => e.filePath !== entry.filePath);
  list.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function removeRecentExternal(filePath: string) {
  const list = getRecentExternal().filter((e) => e.filePath !== filePath);
  localStorage.setItem(KEY, JSON.stringify(list));
}
