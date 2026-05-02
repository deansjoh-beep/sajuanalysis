import React from 'react';
import { elementMap, yinYangMap } from '../../utils/saju';

/**
 * 사주 한자(천간·지지·지장간) 박스.
 * 만세력 페이지의 한지/먹 톤에 맞춰 색을 조정 — 강조 링은 seal-red,
 * 십성 텍스트는 ink-700.
 */
export const HanjaBox: React.FC<{
  hanja: string;
  size?: 'sm' | 'md' | 'lg';
  deity?: string;
  deityPosition?: 'top' | 'bottom';
  highlight?: boolean;
}> = ({ hanja, size = 'md', deity, deityPosition, highlight = false }) => {
  const element = elementMap[hanja];
  const isYang = yinYangMap[hanja] === '+';
  const emphasisClasses = highlight
    ? 'ring-2 ring-[#b8392e]/60 shadow-md scale-110'
    : '';

  // 만세력 디자인 원칙: 한자 박스 1.5배 (40→60, 24→36, 48→72).
  // sm은 모바일에서 w-6(24px)로 축소해 지장간 3개가 좁은 컬럼 안에 들어오도록 함.
  const sizeClasses = {
    sm: 'w-6 h-6 text-[11px] rounded-md md:w-9 md:h-9 md:text-[14px]',
    md: 'w-[60px] h-[60px] text-[24px] rounded-xl',
    lg: 'w-[72px] h-[72px] text-[24px] rounded-2xl',
  };

  const deityFontClass = size === 'sm' ? 'text-[9px] md:text-[12px]' : 'text-[12px]';
  const deityTopClass = size === 'sm' ? '-top-3 md:-top-4' : '-top-4';
  const deityBottomClass = size === 'sm' ? '-bottom-3 md:-bottom-4' : '-bottom-4';

  const deityEl = deity ? (
    <span
      className={`${deityFontClass} font-title font-bold text-[#3a3530] absolute ${
        deityPosition === 'top' ? deityTopClass : deityBottomClass
      } left-1/2 -translate-x-1/2 whitespace-nowrap`}
    >
      {deity}
    </span>
  ) : null;

  if (hanja === '?' || !element) {
    return (
      <div className="relative">
        {deityPosition === 'top' && deityEl}
        <div
          className={`${sizeClasses[size]} border-2 border-[#9c8e7e]/40 flex items-center justify-center opacity-40 text-[#3a3530] ${emphasisClasses}`}
        >
          {hanja}
        </div>
        {deityPosition === 'bottom' && deityEl}
      </div>
    );
  }

  // 금(金) 특수 처리: 양금/음금
  if (element === 'metal') {
    const yangBg = 'bg-[#fdfaf2] border-[#9c8e7e]/40 text-[#6b5d4f]';
    const yinBg = 'bg-[#ebe1c8] border-[#9c8e7e]/40 text-[#3a3530]';

    return (
      <div className="relative">
        {deityPosition === 'top' && deityEl}
        <div
          className={`${sizeClasses[size]} ${
            isYang ? yangBg : yinBg
          } border flex items-center justify-center font-bold ${emphasisClasses}`}
        >
          {hanja}
        </div>
        {deityPosition === 'bottom' && deityEl}
      </div>
    );
  }

  const styles: Record<
    string,
    { bg: string; text: string; border: string; yinText: string }
  > = {
    wood: {
      bg: 'bg-emerald-700',
      text: 'text-emerald-700',
      border: 'border-emerald-700',
      yinText: 'text-[#fdfaf2]',
    },
    fire: {
      bg: 'bg-[#b8392e]',
      text: 'text-[#b8392e]',
      border: 'border-[#b8392e]',
      yinText: 'text-[#fdfaf2]',
    },
    earth: {
      bg: 'bg-[#a88a4a]',
      text: 'text-[#a88a4a]',
      border: 'border-[#a88a4a]',
      yinText: 'text-[#fdfaf2]',
    },
    water: {
      bg: 'bg-[#1a1a1a]',
      text: 'text-[#1a1a1a]',
      border: 'border-[#1a1a1a]',
      yinText: 'text-[#fdfaf2]',
    },
  };

  const style = styles[element];

  if (isYang) {
    return (
      <div className="relative">
        {deityPosition === 'top' && deityEl}
        <div
          className={`${sizeClasses[size]} bg-transparent border-2 ${style.border} ${style.text} flex items-center justify-center font-bold ${emphasisClasses}`}
        >
          {hanja}
        </div>
        {deityPosition === 'bottom' && deityEl}
      </div>
    );
  }
  return (
    <div className="relative">
      {deityPosition === 'top' && deityEl}
      <div
        className={`${sizeClasses[size]} ${style.bg} border-2 ${style.border} ${style.yinText} flex items-center justify-center font-bold ${emphasisClasses}`}
      >
        {hanja}
      </div>
      {deityPosition === 'bottom' && deityEl}
    </div>
  );
};
