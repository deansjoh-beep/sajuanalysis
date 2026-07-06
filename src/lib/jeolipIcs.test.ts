import { describe, expect, it } from 'vitest';
import { buildJeolipIcs } from './jeolipIcs';

describe('buildJeolipIcs — 절입 달력', () => {
  const ics = buildJeolipIcs(2027);

  it('절입 12건 + 신년운세 보는 날 = VEVENT 13건', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(13);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(13);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('입춘이 첫 절입이고 신년운세 이벤트는 종일(VALUE=DATE)', () => {
    expect(ics).toContain('입춘'); // jeolName은 한글(koName)
    expect(ics).toContain('신년운세 보는 날');
    expect(ics).toMatch(/DTSTART;VALUE=DATE:2027020[34]/); // 2027 입춘 = 2월 3~4일(KST)
  });

  it('개인정보(생년월일시·이름)가 들어갈 자리가 없다 — 절입·간지만 포함', () => {
    // 달력은 공용 천문 데이터만 담는다 (생시 미노출 원칙과 동일 맥락)
    expect(ics).not.toMatch(/birth|이름|생년/);
  });

  it('결정론: 같은 입력이면 같은 출력', () => {
    expect(buildJeolipIcs(2027)).toBe(ics);
  });

  it('RFC 5545 CRLF 줄바꿈 사용', () => {
    expect(ics).toContain('\r\n');
    expect(ics.split('\r\n').some((l) => l.includes('\n'))).toBe(false);
  });
});
