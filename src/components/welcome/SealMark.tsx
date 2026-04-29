/**
 * 한국 전통 낙관(낙성관지) 모양 SVG.
 * 사각형 안에 한자 또는 심볼이 들어간 도장 — 강조 포인트로 한 번씩 사용.
 */
interface SealMarkProps {
  /** 도장 안 텍스트 (한 글자~네 글자) */
  text?: string;
  /** 도장 색 */
  color?: string;
  /** 크기 (px) */
  size?: number;
  /** 추가 클래스 */
  className?: string;
}

export function SealMark({
  text = '誠',
  color = '#b8392e',
  size = 64,
  className = '',
}: SealMarkProps) {
  const inset = size * 0.08;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      {/* 바깥 테두리 */}
      <rect
        x={inset}
        y={inset}
        width={size - inset * 2}
        height={size - inset * 2}
        fill={color}
        rx={size * 0.04}
      />
      {/* 안쪽 약간 어두운 영역 (낙관 특유의 음각 느낌) */}
      <rect
        x={inset * 1.6}
        y={inset * 1.6}
        width={size - inset * 3.2}
        height={size - inset * 3.2}
        fill="#f5efe0"
        rx={size * 0.02}
      />
      {/* 한자 */}
      <text
        x="50%"
        y="56%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Nanum Myeongjo', serif"
        fontSize={size * 0.55}
        fontWeight={800}
        fill={color}
      >
        {text}
      </text>
    </svg>
  );
}
