import { expect, test } from '@playwright/test';

test.describe('Ask Reality Check — End-to-End Verification', () => {
  test('verifies Examples A, B, and C, Goal-Seek solver, and Unit switching', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Verify Example A (default preset)
    await expect(page.locator('h1')).toHaveText('Ask Reality Check');
    await expect(page.locator('#vh')).toContainText('Stiff: 7.9x revenue growth needed');
    await expect(page.locator('[data-metric-id="impliedPostMoney"] .v')).toHaveText('₹250 Cr');
    await expect(page.locator('[data-metric-id="nextRoundPreMoney"] .v')).toHaveText('₹500 Cr');
    await expect(page.locator('#gs-output .sv')).toHaveText('₹18.9 Cr');

    // Expand one formula trace for screenshot clarity
    await page.locator('[data-metric-id="impliedPostMoney"] summary').click();

    await page.screenshot({
      path: 'docs/screenshot.png',
      fullPage: false,
    });

    // 2. Switch to Example B ("Note: sized to milestone")
    await page.locator('button[data-id="b"]').click();
    await expect(page.locator('#vh')).toContainText('Reachable: 2.8x revenue growth needed');
    await expect(page.locator('[data-metric-id="impliedPostMoney"] .v')).toHaveText('₹100 Cr');
    await expect(page.locator('[data-metric-id="impliedPostRevenueMultiple"] .v')).toHaveText(
      '8.3x post'
    );
    await expect(page.locator('[data-metric-id="impliedPostRevenueMultiple"] .n')).toContainText(
      '6.7x pre-money'
    );
    await expect(page.locator('[data-metric-id="fundingGap"] .v')).toHaveText('₹20 Cr');

    // 3. Switch to Example C ("Note: ₹150 Cr ask")
    await page.locator('button[data-id="c"]').click();
    await expect(page.locator('#vh')).toContainText('Stiff: 5.6x revenue growth needed');
    await expect(page.locator('[data-metric-id="impliedPostMoney"] .v')).toHaveText('₹600 Cr');
    await expect(page.locator('[data-metric-id="nextRoundPreMoney"] .v')).toHaveText('₹1,200 Cr');
    await expect(page.locator('[data-metric-id="requiredNextAnnualRevenue"] .v')).toHaveText(
      '₹100 Cr'
    );

    // 4. Test Goal-Seek "Apply to inputs" button on Example C
    await expect(page.locator('#gs-output .sv')).toHaveText('₹81 Cr');
    await page.locator('#apply-goalseek-btn').click();
    await expect(page.locator('#vh')).toContainText('Reachable: 3x revenue growth needed');

    // 5. Test Unit Switcher (₹ Cr -> ₹ Lakh scales ₹81 Cr to ₹8,100 Lakh)
    await page.locator('button[data-unit="INR_LAKH"]').click();
    await expect(page.locator('#ask')).toHaveValue('8100');
  });
});
