import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  PDF_ALL_FONT_URLS,
  PDF_SANS_FONT_LINKS,
  PDF_SANS_STACK,
  PDF_SERIF_FONT_LINKS,
  PDF_SERIF_STACK,
  buildFontLinkTags,
} from './pdfFonts';

const repoRoot = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

/**
 * 2026-07-31 프로덕션 장애 회귀 방지.
 *
 * 서버리스 Chromium 컨테이너에는 한글 시스템 폰트가 없다. 두 가지가 겹쳐 리포트 PDF의
 * 한글이 통째로 깨졌다: (1) 한글 글리프가 없는 Noto **SC**(간체)를 강제 지정, (2) Google
 * Fonts URL에 `;`로 굵기를 묶으면 컨테이너에서 폰트가 적용되지 않음. 아래 규칙을 고정한다.
 */
describe('PDF 한글 폰트 규칙', () => {
  it('Google Fonts URL에 `;`(굵기 묶음)를 쓰지 않는다', () => {
    for (const url of PDF_ALL_FONT_URLS) {
      expect(url, `${url} — 굵기마다 <link>를 따로 둘 것`).not.toContain(';');
    }
  });

  it('한글을 담은 Noto KR 계열만 쓰고, 한글 글리프가 없는 SC 계열은 쓰지 않는다', () => {
    expect(PDF_ALL_FONT_URLS.join('\n')).not.toMatch(/Noto\+(Serif|Sans)\+SC/);
    expect(PDF_SERIF_FONT_LINKS).toContain('Noto+Serif+KR');
    expect(PDF_SANS_FONT_LINKS).toContain('Noto+Sans+KR');
  });

  it('굵기 400·700을 모두 싣는다 (본문 + 강조)', () => {
    for (const family of ['Noto+Serif+KR', 'Noto+Sans+KR']) {
      const urls = PDF_ALL_FONT_URLS.filter((u) => u.includes(family));
      expect(urls.map((u) => u.match(/wght@(\d+)/)?.[1]).sort()).toEqual(['400', '700']);
    }
  });

  it('font-family 스택이 웹폰트를 맨 앞에 둔다', () => {
    expect(PDF_SERIF_STACK.startsWith(`'Noto Serif KR'`)).toBe(true);
    expect(PDF_SANS_STACK.startsWith(`'Noto Sans KR'`)).toBe(true);
  });

  it('buildFontLinkTags가 stylesheet link 태그를 만든다', () => {
    expect(buildFontLinkTags(['https://example.test/a.css'])).toBe(
      '<link rel="stylesheet" href="https://example.test/a.css">',
    );
  });
});

describe('PDF HTML 생성 경로가 한글 폰트를 실어 보낸다', () => {
  const pdfHtmlSources = [
    'src/lib/reportPdf.ts',
    'src/lib/iljinCalendar.ts',
    'src/components/admin/PremiumReportPreview.tsx',
    'api/generate-pdf.ts',
  ];

  it.each(pdfHtmlSources)('%s 는 pdfFonts의 폰트 링크를 사용한다', (rel) => {
    expect(read(rel)).toMatch(/PDF_(SERIF|SANS|ALL)_FONT_(LINKS|URLS)/);
  });

  it.each(pdfHtmlSources)('%s 에 한글 없는 SC 폰트가 남아있지 않다', (rel) => {
    expect(read(rel)).not.toMatch(/Noto\s(Serif|Sans)\sSC|Noto\+(Serif|Sans)\+SC/);
  });

  it('머리말·꼬리말 템플릿에는 한글을 쓰지 않는다 (별도 문서라 웹폰트가 닿지 않음)', () => {
    for (const rel of ['api/generate-pdf.ts', 'server.ts']) {
      const source = read(rel);
      for (const key of ['headerTemplate', 'footerTemplate']) {
        const start = source.indexOf(`${key}:`);
        expect(start, `${rel} 에 ${key} 가 있어야 한다`).toBeGreaterThan(-1);
        const template = source.slice(start, source.indexOf('`,', start));
        expect(template, `${rel} ${key} — 한글은 두부 글자로 나간다`).not.toMatch(/[가-힣]/);
      }
    }
  });
});
