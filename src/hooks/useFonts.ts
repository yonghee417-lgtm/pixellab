import { useEffect } from 'react';
import { useFontStore } from '../store/fontStore';

// 번들된 폰트 목록을 받아 CSS @font-face로 등록
export function useFonts() {
  const setFonts = useFontStore((s) => s.setFonts);
  useEffect(() => {
    if (!window.api) return;
    let cancelled = false;
    (async () => {
      const fonts = await window.api.listFonts();
      if (cancelled) return;
      const styleEl = document.createElement('style');
      styleEl.id = 'pixellab-fonts';
      const rules: string[] = [];
      for (const f of fonts) {
        const url = window.api.toMediaUrl(f.path);
        rules.push(`@font-face{font-family:'${f.family}';src:url('${url}');font-display:swap;}`);
      }
      styleEl.textContent = rules.join('\n');
      // 기존거 제거 후 추가
      document.getElementById('pixellab-fonts')?.remove();
      document.head.appendChild(styleEl);
      setFonts(fonts.map((f) => ({
        family: f.family,
        fileName: f.fileName,
        path: f.path,
        category: guessCategory(f.family),
        lang: guessLang(f.family),
      })));
    })();
    return () => { cancelled = true; };
  }, [setFonts]);
}

function guessLang(name: string): 'ko' | 'en' | 'multi' {
  const koPatterns = /Pretendard|NotoSansKR|Nanum|BlackHan|DoHyeon|Jua|Gamja|GowunDodum|GowunBatang|Gugi|EastSeaDokdo|Stylish|SingleDay/i;
  if (koPatterns.test(name)) return name.includes('Pretendard') || name.includes('NotoSansKR') ? 'multi' : 'ko';
  return 'en';
}

function guessCategory(name: string): 'sans' | 'serif' | 'display' | 'handwriting' | 'mono' {
  const display = /Anton|Bebas|Oswald|BlackHan|DoHyeon|Jua|Gugi|PressStart/i;
  const handwriting = /NanumPenScript|GamjaFlower|SingleDay|EastSeaDokdo|DancingScript/i;
  const serif = /Myeongjo|Batang|Playfair|Stylish/i;
  const mono = /JetBrainsMono|Mono|Code/i;
  if (mono.test(name)) return 'mono';
  if (handwriting.test(name)) return 'handwriting';
  if (display.test(name)) return 'display';
  if (serif.test(name)) return 'serif';
  return 'sans';
}
