/**
 * 절입일 달력(.ics) 생성 (IMPLEMENTATION_PLAN 2-4).
 *
 * 사주 연도 Y의 절입 12건(입춘~소한) + "신년운세 보는 날"(입춘 당일) 이벤트를
 * 표준 iCalendar 문자열로 만든다. 전부 클라이언트 계산 — 서버리스 함수 불필요.
 */
import { getWolunData } from './manseryeok/wolun';

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC epoch ms → ICS UTC 타임스탬프 (YYYYMMDDTHHMMSSZ) */
function icsUtc(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** UTC epoch ms → KST 기준 날짜 (YYYYMMDD, 종일 이벤트용) */
function icsKstDate(ms: number): string {
  const d = new Date(ms + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * 사주 연도(입춘 기준) 절입 달력 ICS.
 * dtstamp는 재현성을 위해 호출부에서 주입한다(기본: 해당 연도 1월 1일 UTC).
 */
export function buildJeolipIcs(sajuYear: number, dtstampMs?: number): string {
  const months = getWolunData(sajuYear);
  const stamp = icsUtc(dtstampMs ?? Date.UTC(sajuYear, 0, 1));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//sajuanalysis//jeolip-calendar//KO',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${sajuYear}년 절입 달력`,
  ];

  for (const m of months) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:jeolip-${sajuYear}-${m.index}@sajuanalysis`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsUtc(m.startUtcMs)}`,
      `SUMMARY:${escapeText(`${m.jeolName} — ${m.ganzhi}월 절입`)}`,
      `DESCRIPTION:${escapeText(`${sajuYear}년 ${m.index}번째 달(${m.ganzhi})이 시작되는 절입 시각입니다. 사주의 달은 절입 기준으로 바뀝니다.`)}`,
      'END:VEVENT',
    );
  }

  // 신년운세 보는 날 — 입춘(첫 달 시작) 당일 종일 이벤트
  const ipchun = months[0];
  const dayStart = icsKstDate(ipchun.startUtcMs);
  lines.push(
    'BEGIN:VEVENT',
    `UID:newyear-fortune-${sajuYear}@sajuanalysis`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dayStart}`,
    `SUMMARY:${escapeText(`신년운세 보는 날 — ${sajuYear}년 사주의 새해(입춘)`)}`,
    `DESCRIPTION:${escapeText('사주의 새해는 1월 1일이 아니라 입춘에 시작됩니다. 오늘, 한 해의 운세 지도를 확인해 보세요.')}`,
    'END:VEVENT',
  );

  lines.push('END:VCALENDAR');
  // RFC 5545: CRLF 줄바꿈
  return lines.join('\r\n') + '\r\n';
}
