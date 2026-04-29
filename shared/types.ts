// ─────────────────────────────────────────────────────────────
// PixelLab 공용 타입 (renderer + main 양쪽에서 import)
// ─────────────────────────────────────────────────────────────

export type CanvasPresetKey =
  | 'instagram-square'
  | 'instagram-portrait'
  | 'instagram-story'
  | 'youtube-thumbnail'
  | 'youtube-banner'
  | 'twitter-post'
  | 'facebook-cover'
  // 사진 인쇄 표준 (300dpi)
  | 'photo-3r'
  | 'photo-4r'
  | 'photo-5r'
  | 'photo-6r'
  | 'photo-8r'
  | 'photo-square-100'
  | 'photo-square-150'
  // 증명사진 / 명함 (300dpi)
  | 'passport-photo'
  | 'id-photo-3040'
  | 'id-photo-2530'
  | 'business-card-9054'
  | 'business-card-8555'
  // 인쇄 문서 (300dpi)
  | 'a3-portrait'
  | 'a3-landscape'
  | 'a4-portrait'
  | 'a4-landscape'
  | 'a5-portrait'
  | 'a5-landscape'
  | 'b5-portrait'
  | 'postcard'
  | 'letter-portrait'
  // 화면
  | 'desktop-wallpaper'
  | 'mobile-wallpaper'
  | 'fhd'
  | 'qhd'
  | 'uhd-4k'
  | 'web-1280'
  | 'custom';

export type CanvasPresetGroup =
  | 'social'
  | 'photo-print'
  | 'id-photo'
  | 'document'
  | 'web'
  | 'wallpaper'
  | 'custom';

export interface CanvasPreset {
  key: CanvasPresetKey;
  group: CanvasPresetGroup;
  label: string;
  width: number;
  height: number;
  description: string;
  // px 외 별도 단위로 표시할 때 (예: A4 → "210×297mm")
  displayDims?: string;
}

export const CANVAS_PRESETS: Record<CanvasPresetKey, CanvasPreset> = {
  // ───── 소셜 ─────
  'instagram-square': {
    key: 'instagram-square', group: 'social',
    label: '인스타 정사각', width: 1080, height: 1080,
    description: '1:1 인스타그램 게시물',
  },
  'instagram-portrait': {
    key: 'instagram-portrait', group: 'social',
    label: '인스타 세로', width: 1080, height: 1350,
    description: '4:5 인스타그램 세로 게시물',
  },
  'instagram-story': {
    key: 'instagram-story', group: 'social',
    label: '스토리/릴스', width: 1080, height: 1920,
    description: '9:16 인스타 스토리·릴스·쇼츠',
  },
  'twitter-post': {
    key: 'twitter-post', group: 'social',
    label: '트위터 포스트', width: 1600, height: 900,
    description: '16:9 X (트위터) 게시물',
  },
  'facebook-cover': {
    key: 'facebook-cover', group: 'social',
    label: '페이스북 커버', width: 1640, height: 859,
    description: '페이스북 커버 이미지',
  },
  'youtube-thumbnail': {
    key: 'youtube-thumbnail', group: 'social',
    label: '유튜브 썸네일', width: 1280, height: 720,
    description: '유튜브 권장 썸네일',
  },
  'youtube-banner': {
    key: 'youtube-banner', group: 'social',
    label: '유튜브 배너', width: 2560, height: 1440,
    description: '유튜브 채널 아트',
  },

  // ───── 사진 인쇄 (300dpi) ─────
  'photo-3r': {
    key: 'photo-3r', group: 'photo-print',
    label: '3R / 3.5×5″', width: 1051, height: 1500,
    displayDims: '89×127mm',
    description: '3R 사진 인화 · 89×127mm (3.5×5인치) · 300dpi',
  },
  'photo-4r': {
    key: 'photo-4r', group: 'photo-print',
    label: '4R / 4×6″', width: 1205, height: 1795,
    displayDims: '102×152mm',
    description: '4R 사진 인화 · 102×152mm (4×6인치) — 가장 일반적 · 300dpi',
  },
  'photo-5r': {
    key: 'photo-5r', group: 'photo-print',
    label: '5R / 5×7″', width: 1500, height: 2102,
    displayDims: '127×178mm',
    description: '5R 사진 인화 · 127×178mm (5×7인치) · 300dpi',
  },
  'photo-6r': {
    key: 'photo-6r', group: 'photo-print',
    label: '6R / 6×8″', width: 1795, height: 2398,
    displayDims: '152×203mm',
    description: '6R 사진 인화 · 152×203mm (6×8인치) · 300dpi',
  },
  'photo-8r': {
    key: 'photo-8r', group: 'photo-print',
    label: '8R / 8×10″', width: 2398, height: 3000,
    displayDims: '203×254mm',
    description: '8R 사진 인화 · 203×254mm (8×10인치) · 300dpi',
  },
  'photo-square-100': {
    key: 'photo-square-100', group: 'photo-print',
    label: '정사각 100', width: 1181, height: 1181,
    displayDims: '100×100mm',
    description: '정사각 인화 · 100×100mm · 300dpi',
  },
  'photo-square-150': {
    key: 'photo-square-150', group: 'photo-print',
    label: '정사각 150', width: 1772, height: 1772,
    displayDims: '150×150mm',
    description: '정사각 인화 · 150×150mm · 300dpi',
  },

  // ───── 증명사진 / 명함 (300dpi) ─────
  'passport-photo': {
    key: 'passport-photo', group: 'id-photo',
    label: '여권사진', width: 413, height: 531,
    displayDims: '35×45mm',
    description: '여권/반명함 사진 · 35×45mm · 300dpi',
  },
  'id-photo-3040': {
    key: 'id-photo-3040', group: 'id-photo',
    label: '반명함 사진', width: 354, height: 472,
    displayDims: '30×40mm',
    description: '반명함 증명사진 · 30×40mm · 300dpi',
  },
  'id-photo-2530': {
    key: 'id-photo-2530', group: 'id-photo',
    label: '명함판 사진', width: 295, height: 354,
    displayDims: '25×30mm',
    description: '명함판 증명사진 · 25×30mm · 300dpi',
  },
  'business-card-9054': {
    key: 'business-card-9054', group: 'id-photo',
    label: '명함 (한국)', width: 1063, height: 638,
    displayDims: '90×54mm',
    description: '한국 표준 명함 · 90×54mm · 300dpi',
  },
  'business-card-8555': {
    key: 'business-card-8555', group: 'id-photo',
    label: '명함 (국제)', width: 1004, height: 650,
    displayDims: '85×55mm',
    description: '국제 표준 명함 · 85×55mm · 300dpi',
  },

  // ───── 인쇄 문서 (300dpi) ─────
  'a3-portrait': {
    key: 'a3-portrait', group: 'document',
    label: 'A3 세로', width: 3508, height: 4961,
    displayDims: '297×420mm',
    description: 'A3 세로 · 297×420mm · 300dpi',
  },
  'a3-landscape': {
    key: 'a3-landscape', group: 'document',
    label: 'A3 가로', width: 4961, height: 3508,
    displayDims: '420×297mm',
    description: 'A3 가로 · 420×297mm · 300dpi',
  },
  'a4-portrait': {
    key: 'a4-portrait', group: 'document',
    label: 'A4 세로', width: 2480, height: 3508,
    displayDims: '210×297mm',
    description: 'A4 세로 · 210×297mm · 300dpi',
  },
  'a4-landscape': {
    key: 'a4-landscape', group: 'document',
    label: 'A4 가로', width: 3508, height: 2480,
    displayDims: '297×210mm',
    description: 'A4 가로 · 297×210mm · 300dpi',
  },
  'a5-portrait': {
    key: 'a5-portrait', group: 'document',
    label: 'A5 세로', width: 1748, height: 2480,
    displayDims: '148×210mm',
    description: 'A5 세로 · 148×210mm · 300dpi',
  },
  'a5-landscape': {
    key: 'a5-landscape', group: 'document',
    label: 'A5 가로', width: 2480, height: 1748,
    displayDims: '210×148mm',
    description: 'A5 가로 · 210×148mm · 300dpi',
  },
  'b5-portrait': {
    key: 'b5-portrait', group: 'document',
    label: 'B5 세로', width: 2079, height: 2953,
    displayDims: '176×250mm',
    description: 'B5 세로 · 176×250mm · 300dpi',
  },
  'postcard': {
    key: 'postcard', group: 'document',
    label: '엽서', width: 1181, height: 1748,
    displayDims: '100×148mm',
    description: '표준 엽서 · 100×148mm · 300dpi',
  },
  'letter-portrait': {
    key: 'letter-portrait', group: 'document',
    label: '레터 세로', width: 2550, height: 3300,
    displayDims: '216×279mm',
    description: '미국 레터 · 216×279mm (8.5×11인치) · 300dpi',
  },

  // ───── 화면/배경 ─────
  'desktop-wallpaper': {
    key: 'desktop-wallpaper', group: 'wallpaper',
    label: '데스크탑 배경', width: 1920, height: 1080,
    description: 'FHD 데스크탑 배경화면',
  },
  'mobile-wallpaper': {
    key: 'mobile-wallpaper', group: 'wallpaper',
    label: '모바일 배경', width: 1170, height: 2532,
    description: '아이폰 배경화면 비율',
  },

  // ───── 웹/일반 ─────
  fhd: {
    key: 'fhd', group: 'web',
    label: 'FHD', width: 1920, height: 1080,
    description: '풀 HD',
  },
  qhd: {
    key: 'qhd', group: 'web',
    label: 'QHD', width: 2560, height: 1440,
    description: 'QHD',
  },
  'uhd-4k': {
    key: 'uhd-4k', group: 'web',
    label: '4K UHD', width: 3840, height: 2160,
    description: '4K UHD',
  },
  'web-1280': {
    key: 'web-1280', group: 'web',
    label: '웹 1280', width: 1280, height: 800,
    description: '일반 웹 캔버스',
  },

  custom: {
    key: 'custom', group: 'custom',
    label: '직접 입력', width: 1920, height: 1080,
    description: '원하는 사이즈로 만들기',
  },
};

// ─────────────────────────────────────────────────────────────
// 프로젝트 / 레이어 / 캔버스 모델
// ─────────────────────────────────────────────────────────────

export type LayerKind = 'image' | 'text' | 'shape' | 'drawing' | 'adjustment' | 'group';

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light'
  | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: '표준' },
  { value: 'multiply', label: '곱하기' },
  { value: 'screen', label: '스크린' },
  { value: 'overlay', label: '오버레이' },
  { value: 'darken', label: '어둡게' },
  { value: 'lighten', label: '밝게' },
  { value: 'color-dodge', label: '컬러 닷지' },
  { value: 'color-burn', label: '컬러 번' },
  { value: 'hard-light', label: '하드 라이트' },
  { value: 'soft-light', label: '소프트 라이트' },
  { value: 'difference', label: '차이' },
  { value: 'exclusion', label: '제외' },
  { value: 'hue', label: '색조' },
  { value: 'saturation', label: '채도' },
  { value: 'color', label: '색상' },
  { value: 'luminosity', label: '광도' },
];

export interface CanvasSettings {
  preset: CanvasPresetKey;
  width: number;
  height: number;
  background: string; // hex 색상 또는 'transparent'
  dpi?: number;
}

export interface LayerMeta {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  opacity: number;     // 0..1
  blendMode: BlendMode;
  // Fabric 객체 id (캔버스 내부 객체와 매칭). group 레이어인 경우 children id 배열.
  fabricId: string;
  children?: string[]; // group 인 경우
}

export interface FilterState {
  // 0..2 (1=원본), 또는 -1..1 같은 일반화된 범위. 실제 적용은 fabric filter에서 처리.
  brightness: number;  // -1..1
  contrast: number;    // -1..1
  saturation: number;  // -1..1
  hue: number;         // -180..180 (deg)
  blur: number;        // 0..1
  sharpen: number;     // 0..1
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
  vignette: number;    // 0..1
}

export const DEFAULT_FILTERS: FilterState = {
  brightness: 0, contrast: 0, saturation: 0, hue: 0,
  blur: 0, sharpen: 0, grayscale: false, sepia: false, invert: false, vignette: 0,
};

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: CanvasSettings;
  // Fabric 직렬화 (toDatalessJSON / toJSON 결과). PixelLab은 이미지 src를 dataURL로 임베드.
  canvasJSON: unknown;
  // UI에서 보여줄 레이어 메타. fabric 객체와 fabricId로 연결됨.
  layers: LayerMeta[];
  // 썸네일 (최근 프로젝트 카드용 dataURL, 작게)
  thumbnail?: string;
}

// ─────────────────────────────────────────────────────────────
// 내보내기
// ─────────────────────────────────────────────────────────────

export type ExportFormat = 'png' | 'jpg' | 'webp';

export interface ExportOptions {
  format: ExportFormat;
  quality: number;      // 0..1 (jpg/webp)
  scale: number;        // 1, 2, 3, 0.5 등
  transparent: boolean; // png/webp에서 배경 투명 유지
}

// ─────────────────────────────────────────────────────────────
// 폰트
// ─────────────────────────────────────────────────────────────

export interface FontInfo {
  family: string;       // 표시용 패밀리명 (CSS font-family에 사용)
  fileName: string;     // 파일명
  path: string;         // 절대 경로
  category: 'sans' | 'serif' | 'display' | 'handwriting' | 'mono';
  lang: 'ko' | 'en' | 'multi';
}
