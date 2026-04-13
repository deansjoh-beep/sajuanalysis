import { expect, test } from '@playwright/test';

test.describe('앱 전체 스모크 E2E', () => {
  test('헤더/네비게이션이 렌더링된다', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('유아이 사주상담').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'HOME' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '만세력' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '택일' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '상담' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '리포트' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '프리미엄' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '블로그' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '가이드' }).first()).toBeVisible();
  });

  test('주요 탭 전환이 동작한다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('유아이 사주상담').first()).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: '택일' }).first().click();
    await expect(page.getByText(/택일/).first()).toBeVisible();

    await page.getByRole('button', { name: '상담' }).first().click();
    await expect(page.getByText('상담 모드').first()).toBeVisible();

    await page.getByRole('button', { name: '리포트' }).first().click();
    await expect(page.getByText('운세 리포트가 아직 없습니다.').first()).toBeVisible();

    await page.getByRole('button', { name: '가이드' }).first().click();
    await expect(page.getByText('CEO 인사말').first()).toBeVisible();
  });
});
