import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReportInputFromBirth, runReportGeneration, type BirthFormInput } from './runReportGeneration';
import { parseLifeNavSections } from './premiumReportCore';

// generateLifeNavReport는 LLM 프록시를 호출하므로 유닛 테스트에서 모킹한다.
vi.mock('./generatePremiumReport', () => ({
  generateLifeNavReport: vi.fn(),
}));
import { generateLifeNavReport } from './generatePremiumReport';

const SAMPLE_BIRTH: BirthFormInput = {
  dateStr: '1990-03-15',
  timeStr: '09:30',
  isLunar: false,
  gender: 'M',
  unknownTime: false,
};

// 마커 원문 — 저장될 content 형상.
const SAMPLE_CONTENT = [
  '[SECTION] cover [TITLE] 표지 [SUMMARY] 요약 [CONTENT] 표지 본문입니다. [END]',
  '[SECTION] general [TITLE] 총운 [SUMMARY] 큰 흐름 [CONTENT] 총운 본문이 충분히 길게 이어집니다. [END]',
].join('\n');

describe('buildReportInputFromBirth', () => {
  it('개인정보 불변식: 이름을 주입하지 않는다', () => {
    const input = buildReportInputFromBirth(SAMPLE_BIRTH, 'yearly2026');
    expect(input.name).toBe('');
    expect(input.birthDate).toBe('1990-03-15');
    expect(input.birthTime).toBe('09:30');
    expect(input.productType).toBe('yearly2026');
  });

  it('시간 모름이면 birthTime을 12:00으로 채우고 unknownTime 유지', () => {
    const input = buildReportInputFromBirth({ ...SAMPLE_BIRTH, unknownTime: true }, 'premium');
    expect(input.birthTime).toBe('12:00');
    expect(input.unknownTime).toBe(true);
  });
});

describe('runReportGeneration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(generateLifeNavReport).mockReset();
  });

  it('생성 content를 save-report로 저장하고, 그 content는 동일 섹션으로 재파싱된다(라운드트립)', async () => {
    const sections = parseLifeNavSections(SAMPLE_CONTENT, []);
    vi.mocked(generateLifeNavReport).mockResolvedValue({
      sections,
      saju: null,
      daeun: [],
      yongshin: null,
      content: SAMPLE_CONTENT,
      qualityScore: 88,
    });

    let savedBody: any = null;
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      savedBody = JSON.parse(init.body);
      return { ok: true, json: async () => ({ reportId: 'r-1' }) } as any;
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await runReportGeneration({
      code: 'HW-3F9K2A',
      orderId: 'order-1',
      product: 'yearly2026',
      birth: SAMPLE_BIRTH,
    });

    expect(result.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith('/api/code/save-report', expect.anything());
    expect(savedBody.content).toBe(SAMPLE_CONTENT);
    expect(savedBody.qualityScore).toBe(88);
    // 저장된 content를 다시 파싱하면 원래 섹션이 복원된다.
    const reparsed = parseLifeNavSections(savedBody.content, []);
    expect(reparsed.map((s) => s.id)).toEqual(sections.map((s) => s.id));
    expect(reparsed.map((s) => s.title)).toEqual(sections.map((s) => s.title));
  });

  it('생성 content가 100자 미만이면 저장하지 않고 실패로 반환한다', async () => {
    vi.mocked(generateLifeNavReport).mockResolvedValue({
      sections: [],
      saju: null,
      daeun: [],
      yongshin: null,
      content: '너무 짧음',
      qualityScore: 0,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await runReportGeneration({
      code: 'HW-3F9K2A',
      orderId: 'order-1',
      product: 'yearly2026',
      birth: SAMPLE_BIRTH,
    });

    expect(result.status).toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('save-report가 실패하면 실패 사유를 반환한다', async () => {
    vi.mocked(generateLifeNavReport).mockResolvedValue({
      sections: parseLifeNavSections(SAMPLE_CONTENT, []),
      saju: null,
      daeun: [],
      yongshin: null,
      content: SAMPLE_CONTENT,
      qualityScore: 88,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({ message: '이미 활성 리포트가 있습니다.' }) }) as any),
    );

    const result = await runReportGeneration({
      code: 'HW-3F9K2A',
      orderId: 'order-1',
      product: 'yearly2026',
      birth: SAMPLE_BIRTH,
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.reason).toBe('이미 활성 리포트가 있습니다.');
  });
});
