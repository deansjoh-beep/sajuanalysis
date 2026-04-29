/**
 * 화선지(韓紙) 배경 — SVG feTurbulence로 종이 결과 노이즈를 합성.
 * 이미지 파일 없이 CSS+SVG만으로 구현해 번들·CSP 영향이 없습니다.
 */
export function PaperBackground() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* 베이스 색: 가운데 밝은 한지 톤, 가장자리 살짝 어두워지는 비네팅 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, #fdfaf2 0%, #f8f1de 55%, #ebe1c8 100%)',
        }}
      />

      {/* 미세 노이즈 (종이 표면 입자) */}
      <svg
        className="absolute inset-0 w-full h-full mix-blend-multiply"
        style={{ opacity: 0.32 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="paperNoise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            values="0 0 0 0 0.42
                    0 0 0 0 0.36
                    0 0 0 0 0.26
                    0 0 0 0.18 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#paperNoise)" />
      </svg>

      {/* 길고 가로 결의 섬유질 (한지 특유의 긴 결) */}
      <svg
        className="absolute inset-0 w-full h-full mix-blend-multiply"
        style={{ opacity: 0.18 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="paperFibers">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.012 0.45"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix
            values="0 0 0 0 0.32
                    0 0 0 0 0.26
                    0 0 0 0 0.18
                    0 0 0 0.55 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#paperFibers)" />
      </svg>

      {/* 가장자리 어둠 (종이 가장자리 누른 자국 같은 비네팅) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(120, 90, 50, 0.14) 100%)',
        }}
      />
    </div>
  );
}
