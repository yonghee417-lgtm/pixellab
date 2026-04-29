/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PixelLab — 검정 베이스, 골든 망고 액센트 (FrameLab과 톤 통일)
        bg: {
          base: '#0a0a0c',
          panel: '#131316',
          surface: '#1a1a1f',
          elevated: '#232328',
          hover: '#2a2a31',
          canvas: '#1a1a1f',
        },
        border: {
          subtle: '#26262d',
          strong: '#38383f',
        },
        text: {
          primary: '#f5f5f7',
          secondary: '#a1a1aa',
          muted: '#6b6b75',
        },
        // 메인 액센트 — 골든 망고
        accent: {
          DEFAULT: '#FFAE00',
          hover: '#FFC233',
          subtle: '#FFAE0022',
          strong: '#FF9900',
          muted: '#FFAE0055',
        },
        // 보조 액센트 — 웜 오렌지
        warm: {
          DEFAULT: '#FF8C42',
          hover: '#FF9F5C',
          subtle: '#FF8C4222',
        },
        // 레이어 타입별 컬러 태그 (얇은 좌측 인디케이터에 사용)
        layer: {
          image: '#3b82f6',
          text: '#FFAE00',
          shape: '#FF8C42',
          drawing: '#10b981',
          adjustment: '#a78bfa',
          group: '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-accent': '0 0 0 1px rgba(255, 174, 0, 0.4), 0 0 20px rgba(255, 174, 0, 0.15)',
      },
    },
  },
  plugins: [],
};
