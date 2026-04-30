import { motion, useReducedMotion } from 'motion/react';

interface BrushTextProps {
  /** 표시할 텍스트 (한 줄) */
  children: string;
  /** 글자 크기 (px) */
  fontSize?: number;
  /** 시작 지연 (초) */
  delay?: number;
  /** stroke 그리기 시간 (초) */
  duration?: number;
  /** stroke 색 */
  strokeColor?: string;
  /** 채워질 글자 색 */
  fillColor?: string;
  /** 추가 클래스 */
  className?: string;
  /** 굵기 (font-weight) */
  fontWeight?: number;
}

/**
 * 붓글씨처럼 획이 그려지는 SVG 텍스트.
 *
 * 1단계 구현: Nanum Myeongjo 폰트의 글자 외곽선을 stroke로 그렸다가,
 * 그리기가 끝날 즈음 fill이 페이드인되어 완성됨.
 *
 * 향후 손글씨 SVG path로 교체 가능하도록 props로 추상화.
 */
export function BrushText({
  children,
  fontSize = 80,
  delay = 0,
  duration = 2.4,
  strokeColor = '#1a1a1a',
  fillColor = '#1a1a1a',
  className = '',
  fontWeight = 800,
}: BrushTextProps) {
  const reduced = useReducedMotion();

  // 한글 평균 1글자 ≈ fontSize, 약간의 좌우 여백 포함
  const width = Math.max(children.length, 1) * fontSize * 1.05;
  const height = fontSize * 1.3;
  // 글자 외곽선 길이를 정확히 알 수 없으므로 충분히 큰 dash 길이 사용
  const dashLength = width * 5;

  // reduced motion 시 즉시 표시
  if (reduced) {
    return (
      <svg
        className={className}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        preserveAspectRatio="xMinYMid meet"
        aria-label={children}
      >
        <text
          x="0"
          y={fontSize}
          fontFamily="'Nanum Myeongjo', serif"
          fontSize={fontSize}
          fontWeight={fontWeight}
          fill={fillColor}
        >
          {children}
        </text>
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      preserveAspectRatio="xMinYMid meet"
      aria-label={children}
    >
      {/* 외곽선이 그려지는 stroke 레이어 */}
      <motion.text
        x="0"
        y={fontSize}
        fontFamily="'Nanum Myeongjo', serif"
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill="transparent"
        stroke={strokeColor}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={dashLength}
        initial={{ strokeDashoffset: dashLength }}
        animate={{ strokeDashoffset: 0 }}
        transition={{
          duration,
          delay,
          ease: [0.45, 0.05, 0.55, 0.95],
        }}
      >
        {children}
      </motion.text>

      {/* 그리기 끝나갈 무렵 fill이 페이드인 */}
      <motion.text
        x="0"
        y={fontSize}
        fontFamily="'Nanum Myeongjo', serif"
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={fillColor}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.9,
          delay: delay + duration * 0.75,
          ease: 'easeOut',
        }}
      >
        {children}
      </motion.text>
    </svg>
  );
}
