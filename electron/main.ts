import { app, BrowserWindow, ipcMain, dialog, protocol, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import type { Project } from '../shared/types';

// 로컬 이미지 / 폰트 / 미디어를 안전하게 로드하기 위한 커스텀 프로토콜
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pixellab-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

let mainWindow: BrowserWindow | null = null;

function getUserDataDir() {
  return path.join(app.getPath('userData'), 'projects');
}

async function ensureUserDataDir() {
  const dir = getUserDataDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, 'thumbnails'), { recursive: true });
  return dir;
}

function getFontDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'fonts')
    : path.join(process.env.APP_ROOT!, 'assets', 'fonts');
}

function createWindow() {
  // 개발 모드에서 윈도우 타이틀바/작업표시줄 아이콘 표시.
  // 패키지된 앱은 OS가 ICO/ICNS를 사용하므로 별도 지정 불필요.
  const iconPath = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT!, 'build', 'icon.png')
    : undefined;

  mainWindow = new BrowserWindow({
    title: 'PixelLab',
    icon: iconPath,
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a0c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

function registerMediaProtocol() {
  protocol.handle('pixellab-media', async (request) => {
    const url = new URL(request.url);
    const filePath = url.pathname
      .replace(/^\//, '')
      .split('/')
      .map((seg) => decodeURIComponent(seg))
      .join('/');
    try {
      const stat = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
      const range = request.headers.get('range');
      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
          const stream = createReadStream(filePath, { start, end });
          return new Response(Readable.toWeb(stream) as ReadableStream, {
            status: 206,
            headers: {
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(end - start + 1),
              'Content-Type': mime,
            },
          });
        }
      }
      const stream = createReadStream(filePath);
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        headers: {
          'Content-Length': String(stat.size),
          'Accept-Ranges': 'bytes',
          'Content-Type': mime,
        },
      });
    } catch (err) {
      console.error('[pixellab-media] 로드 실패:', filePath, err);
      return new Response('Not found', { status: 404 });
    }
  });
}

app.whenReady().then(async () => {
  registerMediaProtocol();
  await ensureUserDataDir();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ───────────────── IPC: 외부 URL 열기 (배너 광고 클릭 등) ─────────────────
ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  // 안전 가드 — http(s)만 허용
  if (typeof url !== 'string') return false;
  if (!/^https?:\/\//i.test(url)) return false;
  await shell.openExternal(url);
  return true;
});

// ───────────────── IPC: 다이얼로그 ─────────────────

ipcMain.handle('dialog:openImage', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '이미지 가져오기',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '이미지', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('dialog:saveExport', async (_e, defaultName: string, ext: string) => {
  if (!mainWindow) return null;
  const safe = defaultName.replace(/[\\/:*?"<>|]/g, '_');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '내보내기',
    defaultPath: `${safe}.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  return result.canceled ? null : result.filePath;
});

// ───────────────── IPC: 파일 입출력 ─────────────────

ipcMain.handle('file:exists', async (_e, filePath: string) => {
  try { await fs.access(filePath); return true; } catch { return false; }
});

// 이미지 파일을 buffer/dataURL로 직접 읽기 (drag&drop, recent open 등에 사용)
ipcMain.handle('file:readImageDataUrl', async (_e, filePath: string) => {
  try {
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] ?? 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (err) {
    return null;
  }
});

ipcMain.handle('export:writeBuffer', async (_e, filePath: string, base64: string) => {
  const buffer = Buffer.from(base64, 'base64');
  await fs.writeFile(filePath, buffer);
  return filePath;
});

// ───────────────── IPC: 프로젝트 ─────────────────

ipcMain.handle('project:save', async (_e, project: Project) => {
  const dir = getUserDataDir();
  const filePath = path.join(dir, `${project.id}.pxlab`);
  await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8');
  return filePath;
});

ipcMain.handle('project:saveToPath', async (_e, project: Project, filePath: string) => {
  await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8');
  return filePath;
});

ipcMain.handle('project:saveAs', async (_e, project: Project, defaultName?: string) => {
  if (!mainWindow) return null;
  const safe = (defaultName ?? project.name ?? 'project').replace(/[\\/:*?"<>|]/g, '_');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '다른 이름으로 저장',
    defaultPath: `${safe}.pxlab`,
    filters: [{ name: 'PixelLab 프로젝트', extensions: ['pxlab', 'json'] }],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, JSON.stringify(project, null, 2), 'utf-8');
  return result.filePath;
});

ipcMain.handle('project:openFile', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '프로젝트 파일 열기',
    properties: ['openFile'],
    filters: [
      { name: 'PixelLab 프로젝트', extensions: ['pxlab', 'json'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const project = JSON.parse(data) as Project;
    return { project, filePath };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('project:openFromPath', async (_e, filePath: string) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const project = JSON.parse(data) as Project;
    return { project, filePath };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('project:list', async () => {
  const dir = getUserDataDir();
  const entries = await fs.readdir(dir);
  const projects: Project[] = [];
  for (const name of entries) {
    if (!name.endsWith('.pxlab')) continue;
    try {
      const data = await fs.readFile(path.join(dir, name), 'utf-8');
      const p = JSON.parse(data) as Project;
      try {
        const stat = await fs.stat(path.join(dir, name));
        if (!p.updatedAt || p.updatedAt === 0) p.updatedAt = stat.mtimeMs;
      } catch {}
      projects.push(p);
    } catch {}
  }
  return projects.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
});

ipcMain.handle('project:delete', async (_e, projectId: string) => {
  const dir = getUserDataDir();
  const filePath = path.join(dir, `${projectId}.pxlab`);
  try { await fs.unlink(filePath); return true; } catch { return false; }
});

ipcMain.handle('project:libraryPath', async () => getUserDataDir());

// ───────────────── IPC: 폰트 ─────────────────

ipcMain.handle('fonts:list', async () => {
  const fontDir = getFontDir();
  try {
    const entries = await fs.readdir(fontDir);
    return entries
      .filter((f) => /\.(ttf|otf|woff|woff2)$/i.test(f))
      .map((f) => ({
        family: path.basename(f, path.extname(f)),
        path: path.join(fontDir, f),
        fileName: f,
      }));
  } catch {
    return [];
  }
});

ipcMain.handle('fonts:dir', async () => getFontDir());
