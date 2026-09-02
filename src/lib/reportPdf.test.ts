import { describe, expect, it } from 'vitest';
import { buildReportPdfFileName, buildReportPdfHtml, iljuLabel, stripMarkers } from './reportPdf';
import type { MyeongsikParams } from './buildMyeongsik';

const MYEONGSIK: MyeongsikParams = {
  pillars: { year: '丙寅', month: '甲午', day: '丙戌', hour: null },
  gender: 'female',
  daeunsu: 5,
  daeunDirection: 'forward',
  birthYear: 1986,
  timeUnknown: true,
};

const ISSUED = new Date(2026, 8, 2); // 2026-09-02

describe('buildReportPdfFileName', () => {
  it('회원 이름이 있으면 이름 + 조회날짜', () => {
    expect(buildReportPdfFileName('홍길동', MYEONGSIK, '76-VWME9C', ISSUED)).toBe(
      '사주리포트_홍길동_20260902.pdf',
    );
  });

  it('이름의 파일명 금지 문자·공백은 제거된다', () => {
    expect(buildReportPdfFileName('홍 길동/테스트', MYEONGSIK, '76-VWME9C', ISSUED)).toBe(
      '사주리포트_홍길동테스트_20260902.pdf',
    );
  });

  it('이름이 없으면 일주 한글 호칭으로 대체', () => {
    expect(buildReportPdfFileName(null, MYEONGSIK, '76-VWME9C', ISSUED)).toBe(
      '사주리포트_병술일주_20260902.pdf',
    );
  });

  it('명식도 없으면 코드로 대체', () => {
    expect(buildReportPdfFileName(null, null, '76-VWME9C', ISSUED)).toBe(
      '사주리포트_76-VWME9C_20260902.pdf',
    );
  });
});

describe('iljuLabel', () => {
  it('일주 간지 → 한글 호칭', () => {
    expect(iljuLabel(MYEONGSIK)).toBe('병술일주');
  });
  it('명식 없음 → null', () => {
    expect(iljuLabel(null)).toBeNull();
  });
});

describe('buildReportPdfHtml — 표지', () => {
  const html = buildReportPdfHtml({
    code: '76-VWME9C',
    productLabel: '2026 일년운세 리포트',
    myeongsik: MYEONGSIK,
    sections: [{ id: 's1', title: '총운', summary: '[SUMMARY]요약', content: '[CONTENT]본문 **강조**' }],
    issuedAt: ISSUED,
  });

  it('제목·발행일·코드·웰컴 문구가 실린다', () => {
    expect(html).toContain('2026 일년운세 리포트');
    expect(html).toContain('발행일 2026년 9월 2일');
    expect(html).toContain('76-VWME9C');
    expect(html).toContain('고객님, 안녕하세요');
    expect(html).toContain('타고난 기질과 앞으로의 흐름');
  });

  it('명식 카드: 간지 한자·십성·오행 색 박스 (HanjaBox 규칙)', () => {
    expect(html).toContain('pillar-card');
    expect(html).toContain('丙');
    expect(html).toContain('戌');
    expect(html).toContain('일간'); // 일간 자리 표기
    expect(html).toContain('편인'); // 월간 甲 → 丙 기준 편인
    expect(html).toContain('#b8392e'); // 丙 양화 → 외곽선 적색
    expect(html).toContain('#047857'); // 甲 양목 → 외곽선 녹색
  });

  it('시간 미상이면 시주 카드를 만들지 않는다 (ManseTab과 동일)', () => {
    expect(html).not.toContain('시주');
  });

  it('음간지는 채움 박스, 금(金)은 미색·모래색 특수 배경 (HanjaBox 규칙)', () => {
    const h = buildReportPdfHtml({
      code: '76-VWME9C',
      productLabel: '평생 사주 리포트',
      myeongsik: { ...MYEONGSIK, pillars: { year: '辛巳', month: '庚子', day: '乙亥', hour: '甲子' } },
      sections: [],
      issuedAt: ISSUED,
    });
    expect(h).toContain('background: #047857'); // 乙 음목 → 채움
    expect(h).toContain('background: #ebe1c8'); // 辛 음금 → 모래색
    expect(h).toContain('background: #fdfaf2'); // 庚 양금 → 미색
    expect(h).toContain('background: #1a1a1a'); // 亥 음수 → 먹색
  });

  it('핵심 정보: 곤명·대운수·오행 분포·시간 미상', () => {
    expect(html).toContain('곤명');
    expect(html).toContain('대운수 5 순행');
    expect(html).toContain('오행 분포');
    expect(html).toContain('시간 미상');
  });

  it('생년월일 원문(출생연도 포함)은 표지에 싣지 않는다', () => {
    expect(html).not.toContain('1986');
  });

  it('본문 마커는 제거되고 강조는 변환된다', () => {
    expect(html).not.toContain('[SUMMARY]');
    expect(html).not.toContain('[CONTENT]');
    expect(html).toContain('<strong>강조</strong>');
  });
});

describe('buildReportPdfHtml — 유료 상품 공통 커버', () => {
  // CodeLookupTab PRODUCT_LABEL과 동일한 4종 — 어떤 유료 리포트든 같은 커버 구조를 받는다.
  const PAID_LABELS = [
    '평생 사주 리포트',
    '2026 일년운세 리포트',
    '직업·재물운 리포트',
    '연애·결혼운 리포트',
  ];

  it.each(PAID_LABELS)('%s 커버에 제목·웰컴 문구·명식 표·핵심 정보가 실린다', (label) => {
    const html = buildReportPdfHtml({
      code: '76-VWME9C',
      productLabel: label,
      myeongsik: MYEONGSIK,
      sections: [],
      issuedAt: ISSUED,
    });
    expect(html).toContain(label);
    expect(html).toContain('고객님, 안녕하세요');
    expect(html).toContain('class="manse"');
    expect(html).toContain('오행 분포');
    expect(html).toContain('발행일 2026년 9월 2일');
  });
});

describe('stripMarkers', () => {
  it('구조 마커를 제거한다', () => {
    expect(stripMarkers('[SECTION]안녕[/SECTION]')).toBe('안녕');
  });
});
