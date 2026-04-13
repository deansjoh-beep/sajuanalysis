import { expect, test } from '@playwright/test';

test.describe('프리미엄 리포트 회귀 E2E', () => {
  test('주문 선택 → 입력 자동채움 → 미리보기 → PDF 생성', async ({ page }) => {
    let pdfRequestCount = 0;

    await page.route('**/api/premium-orders**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orders: [
            {
              orderId: 'e2e-order-1',
              name: '홍길동',
              email: 'hong@example.com',
              birthDate: '1991-05-12',
              birthTime: '08:30',
              isLunar: false,
              isLeap: false,
              unknownTime: false,
              gender: 'M',
              tier: 'premium',
              price: 99000,
              concern: '사업 확장 타이밍 점검',
              interest: '사업, 투자',
              status: 'submitted',
              reportLevel: 'advanced',
              lifeEvents: [{ year: 2018, description: '첫 창업' }],
              version: 1,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/generate-pdf', async (route) => {
      pdfRequestCount += 1;
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="e2e.pdf"',
        },
        body: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF'),
      });
    });

    await page.goto('/?e2e=premium#admin');

    await expect(page.getByText('관리자 페이지').first()).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: '프리미엄 주문' }).click();
    await expect(page.getByText('프리미엄 리포트 주문').first()).toBeVisible();

    await page.getByRole('button', { name: /홍길동/ }).first().click();
    await expect(page.getByRole('button', { name: '리포트 생성' })).toBeVisible();

    await page.getByRole('button', { name: '리포트 생성' }).click();

    await expect(page.getByRole('heading', { name: '고객 정보 입력' })).toBeVisible();
    await expect(page.getByPlaceholder('홍길동')).toHaveValue('홍길동');
    await expect(page.locator('input[type="date"]')).toHaveValue('1991-05-12');
    await expect(page.locator('input[type="time"]')).toHaveValue('08:30');

    await page.getByRole('button', { name: '웹 보고서 생성하기' }).click();

    await expect(page.getByRole('button', { name: 'PDF' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('당신을 위한 인생가이드북')).toBeVisible();

    await page.getByRole('button', { name: 'PDF' }).click();

    await expect.poll(() => pdfRequestCount).toBe(1);
    await expect(page.getByText('PDF 저장 완료')).toBeVisible();
  });
});
