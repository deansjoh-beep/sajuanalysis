/**
 * 클로즈드 베타 무료 코드 발급 (IMPLEMENTATION_PLAN 3-2).
 *
 * 베타 코드 = 명식 없는 미사용 코드(수령자가 코드 입력 + 생시 입력으로 리딤)
 *           + 0원 주문(리포트 생성 자격·후속 질문 3회).
 * 기존 스키마·흐름을 그대로 사용 — 별도 테이블 없음.
 */
import type { Db } from './client.js';
import { issueCode } from './code.js';
import type { PaidProduct } from './payment.js';
import { orders } from './schema.js';

export interface BetaIssueResult {
  codes: string[];
}

export async function issueBetaCodes(
  db: Db,
  count: number,
  product: PaidProduct,
  onProgress?: (issued: number) => void,
): Promise<BetaIssueResult> {
  const issued: string[] = [];
  for (let i = 0; i < count; i++) {
    const { id: codeId, code } = await issueCode(db, null); // 미사용 선물형 코드
    await db.insert(orders).values({
      orderNo: `beta-${code}`,
      paymentKey: 'beta-free',
      codeId,
      product,
      status: 'paid', // 결제 완료와 동일한 자격 (0원)
      amount: 0,
    });
    issued.push(code);
    if (onProgress && (i + 1) % 50 === 0) onProgress(i + 1);
  }
  return { codes: issued };
}
