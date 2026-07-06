import { expect, test } from '@playwright/test';

test.describe('앱 전체 스모크 E2E', () => {
  test('헤더/네비게이션이 렌더링된다', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('유아이 사주상담').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'HOME' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '만세력' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '오늘의 운세' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '상담' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '프리미엄리포트' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '리포트 조회' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '블로그' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'HELP' }).first()).toBeVisible();
  });

  test('주요 탭 전환이 동작한다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('유아이 사주상담').first()).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: '상담' }).first().click();
    // 채팅 탭 활성 시에만 헤더에 나타나는 버튼
    await expect(page.getByText('텍스트 저장').first()).toBeVisible();

    await page.getByRole('button', { name: '리포트 조회' }).first().click();
    await expect(page.getByText('구매 시 받은 사주 코드로 리포트를 다시 열람하세요', { exact: false }).first()).toBeVisible();

    await page.getByRole('button', { name: '오늘의 운세' }).first().click();
    await expect(page.getByRole('heading', { name: '오늘의 운세' }).first()).toBeVisible();
  });
});
