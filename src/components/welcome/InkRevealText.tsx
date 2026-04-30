import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface InkRevealTextProps {
  children: string;
  className?: string;
  /** 시작 지연 (초) */
  delay?: number;
  /** 글자 사이 간격 (초) */
  staggerDelay?: number;
  /** 한 글자당 애니메이션 시간 (초) */
  duration?: number;
  /** 뷰포트 진입 시 트리거 (false면 mount 즉시) */
  triggerOnView?: boolean;
  /** 시맨틱 태그 (기본 span) */
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4';
}

/**
 * 글자 단위로 잉크가 번지듯 fade-in되는 텍스트.
 * 화선지에 먹이 스며드는 느낌을 짧은 blur transition으로 표현.
 */
export function InkRevealText({
  children,
  className = '',
  delay = 0,
  staggerDelay = 0.04,
  duration = 0.55,
  triggerOnView = true,
  as = 'span',
}: InkRevealTextProps) {
  const reduced = useReducedMotion();
  const Tag = as as 'span';

  if (reduced) {
    return <Tag className={className}>{children}</Tag>;
  }

  const initial = { opacity: 0, y: 8, filter: 'blur(6px)' };
  const target = { opacity: 1, y: 0, filter: 'blur(0px)' };

  // 줄바꿈은 그대로 보존
  const chars = Array.from(children);

  const renderChar = (ch: string, i: number): ReactNode => {
    if (ch === '\n') {
      return <br key={`br-${i}`} />;
    }
    return (
      <motion.span
        key={i}
        aria-hidden={true}
        className="inline-block"
        initial={initial}
        {...(triggerOnView
          ? { whileInView: target, viewport: { once: true, amount: 0.3 } }
          : { animate: target })}
        transition={{
          duration,
          delay: delay + i * staggerDelay,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {ch === ' ' ? '\u00A0' : ch}
      </motion.span>
    );
  };

  return (
    <Tag className={className} aria-label={children}>
      {chars.map(renderChar)}
    </Tag>
  );
}
