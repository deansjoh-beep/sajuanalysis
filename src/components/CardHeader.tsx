import React from 'react';
import { CARD_HEADER_ROW, CARD_HEADER_ICON, CARD_HEADER_TITLE } from '../constants/styles';

/**
 * 카드 상단 헤더.
 * - icon 또는 badge 중 하나를 제목 왼쪽에 배치하여 "아이콘 옆 제목" 구조를 보장합니다.
 * - min-h 가 적용된 CARD_HEADER_ROW 를 사용하므로 여러 카드 간 제목행 높이가 일정하게 정렬됩니다.
 * - title 크기는 TEXT_TITLE(16px) 과 동일합니다.
 */
export interface CardHeaderProps {
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  title: React.ReactNode;
  titleClassName?: string;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  icon,
  badge,
  title,
  titleClassName,
  className,
}) => (
  <div className={`${CARD_HEADER_ROW}${className ? ` ${className}` : ''}`}>
    {icon && <span className={CARD_HEADER_ICON}>{icon}</span>}
    {badge && <span className={CARD_HEADER_ICON}>{badge}</span>}
    <h3 className={titleClassName ?? CARD_HEADER_TITLE}>{title}</h3>
  </div>
);

export default CardHeader;
