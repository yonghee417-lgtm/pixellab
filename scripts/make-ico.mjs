// build/icon.png → build/icon.ico 변환
// NSIS 인스톨러 / 윈도우 .exe 아이콘은 ICO 형식만 받기 때문에 빌드 전 자동 생성.
//
// 실행: npm run icon (또는 npm run build 안에서 자동 호출)

import pngToIco from 'png-to-ico';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PNG = path.join(__dirname, '..', 'build', 'icon.png');
const ICO = path.join(__dirname, '..', 'build', 'icon.ico');

try {
  await fs.access(PNG);
} catch {
  console.error(`✗ icon.png 가 없습니다: ${PNG}`);
  process.exit(1);
}

const buf = await pngToIco(PNG);
await fs.writeFile(ICO, buf);
console.log(`✓ icon.ico 생성됨 (${(buf.length / 1024).toFixed(1)}KB) → ${ICO}`);
