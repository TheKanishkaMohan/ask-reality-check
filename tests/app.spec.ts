import { expect, test } from '@playwright/test';

test.describe('Valuation Check — Charts, CAGR Verdicts, Sector Drawer & XLSX Verification', () => {
  test('verifies charts without tile duplication, CAGR card & horizon verdicts, sector drawer, planner placeholder, and XLSX export', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const externalRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('request', (req) => {
      const url = req.url();
      if (
        !url.startsWith('http://localhost:') &&
        !url.startsWith('http://127.0.0.1:') &&
        !url.startsWith('data:') &&
        !url.startsWith('blob:')
      ) {
        externalRequests.push(url);
      }
    });

    await page.goto('/');

    // 1. Verify Topbar (consistent with funding.kanishkamohan.com + Tools dropdown), Footer, Hero, and single Sajith Pai footnote
    await expect(page.locator('header.topbar .brand-wordmark')).toHaveText('TheKanishkaMohan');
    await expect(page.locator('header.topbar .brand-sub')).toHaveText('Funding · DeepTech India');

    const topNavOrder = await page
      .locator('header.topbar nav > a, header.topbar nav > details#nav-tools > summary')
      .allInnerTexts();
    expect(topNavOrder.map((t) => t.trim())).toEqual([
      'Overview',
      'Grants',
      'Equity',
      'Debt',
      'Subsidies',
      'Tools',
      'About',
    ]);
    await expect(page.locator('#nav-tools > summary.nav-dropdown__trigger.is-current')).toBeVisible();

    await page.locator('#nav-tools > summary').click();
    await expect(page.locator('#nav-tools')).toHaveAttribute('open', '');
    await expect(page.locator('#nav-tools .nav-dropdown__menu a[aria-current="page"]')).toContainText(
      'Valuation Check'
    );
    await expect(
      page.locator('#nav-tools .nav-dropdown__menu .nav-dropdown__soon', {
        hasText: 'AIF Radar',
      })
    ).toContainText('Soon');
    await expect(
      page.locator('#nav-tools .nav-dropdown__menu .nav-dropdown__soon', {
        hasText: 'DeepTech Round Planner',
      })
    ).toContainText('Soon');
    await expect(
      page.locator('footer.site-footer .site-footer__soon', {
        hasText: 'AIF Radar',
      })
    ).toContainText('Soon');
    await expect(
      page.locator('footer.site-footer .site-footer__soon', {
        hasText: 'DeepTech Round Planner',
      })
    ).toContainText('Soon');

    const desktopOverflowOpen = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(desktopOverflowOpen).toBe(false);

    await page.keyboard.press('Escape');
    await expect(page.locator('#nav-tools')).not.toHaveAttribute('open', '');

    await page.locator('#nav-tools > summary').click();
    await expect(page.locator('#nav-tools')).toHaveAttribute('open', '');
    await page.locator('h1').click();
    await expect(page.locator('#nav-tools')).not.toHaveAttribute('open', '');

    await expect(page.locator('h1')).toHaveText('Valuation Check');
    await expect(page.locator('body')).not.toContainText('Your ask sets the valuation a VC hears');

    await expect(page.getByText('Sajith Pai')).toHaveCount(1);
    await expect(page.locator('.vc-credit-footnote')).toHaveText(
      'Calculations run inside your browser; nothing leaves your device. Thanks to Sajith Pai for inspiring this tool.'
    );
    await expect(page.locator('.site-footer__copy')).toHaveText(
      '© 2026 Kanishka Mohan. All rights reserved. Names, trademarks and excerpts belong to their respective owners. Summaries are AI-assisted and may contain errors. Confirm terms on the official page before applying. Not financial or legal advice.'
    );

    // 2. Verify Download XLSX CTA exists & legacy Copy/Print buttons are absent
    await expect(page.getByRole('button', { name: /Copy link/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Copy Markdown/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Print/i })).toHaveCount(0);
    await expect(page.locator('#download-xlsx-btn')).toHaveText('Download XLSX');

    // 3. Verify top-to-bottom layout: R0 & ESOP sits above Config, Burn sits next to Ask, all drawers sit above results
    const examplesBox = await page.locator('#examples-panel').boundingBox();
    const settingsBox = await page.locator('#settings-drawer').boundingBox();
    const configBox = await page.locator('.vc-config-card').boundingBox();
    const sectorBox = await page.locator('#sector-benchmarks-drawer').boundingBox();
    const assumptionsBox = await page.locator('#assumptions-drawer').boundingBox();
    const resultsBox = await page.locator('#results-panel').boundingBox();
    const cashBox = await page.locator('#cash').boundingBox();
    const askBox = await page.locator('#ask').boundingBox();
    expect(examplesBox).not.toBeNull();
    expect(settingsBox).not.toBeNull();
    expect(configBox).not.toBeNull();
    expect(sectorBox).not.toBeNull();
    expect(assumptionsBox).not.toBeNull();
    expect(resultsBox).not.toBeNull();
    expect(cashBox).not.toBeNull();
    expect(askBox).not.toBeNull();
    expect(examplesBox!.y).toBeLessThan(settingsBox!.y);
    expect(settingsBox!.y).toBeLessThan(configBox!.y);
    expect(configBox!.y).toBeLessThan(resultsBox!.y);
    expect(sectorBox!.y).toBeLessThan(resultsBox!.y);
    expect(assumptionsBox!.y).toBeLessThan(resultsBox!.y);
    expect(Math.abs(cashBox!.y - askBox!.y)).toBeLessThan(5);
    expect(cashBox!.x).toBeLessThan(askBox!.x);

    // Settings drawer has fixed verdict bands (no editable band-reach / band-stretch) and removed legacy notes
    await expect(page.locator('#band-reach')).toHaveCount(0);
    await expect(page.locator('#band-stretch')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Indicative Indian Series A/B next-round ranges');
    await expect(page.locator('.vc-caveat-inline')).toHaveCount(0);

    // Verify (i) info buttons exist on all inputs and #mult tooltip contains Multiple note
    const tipCount = await page.locator('.tkm-tip__btn').count();
    expect(tipCount).toBeGreaterThanOrEqual(10);
    await page.locator('[aria-describedby="tip-mult"]').click();
    await expect(page.locator('#tip-mult')).toBeVisible();
    await expect(page.locator('#tip-mult')).toContainText('Revenue multiples fit software');
    await page.locator('h1').click();
    await expect(page.locator('#tip-mult')).toBeHidden();

    // Verify zero em-dashes anywhere in rendered page text
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain('—');

    // 4. Verify CSP hygiene, sensitivity table fit, and zero horizontal overflow at desktop (1280px)
    const inlineStyleCount = await page.evaluate(() => document.querySelectorAll('[style]').length);
    expect(inlineStyleCount).toBe(0);
    expect(externalRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(desktopOverflow).toBe(false);

    const sensTableFits = await page.evaluate(() => {
      const wrap = document.querySelector('#sens')?.parentElement;
      return wrap ? wrap.scrollWidth <= wrap.clientWidth + 1 : false;
    });
    expect(sensTableFits).toBe(true);
    await expect(page.locator('#burn-bar')).toBeHidden();

    // 5. Verify Example A charts and 3-card non-redundant signals strip
    await expect(page.locator('#vh')).toContainText('Stiff: 7.9x revenue growth needed in 18 months (298%/yr CAGR)');

    // Charts show R1 Pre > R1 Ask > R1 Post > R2 Pre order, ₹250 Cr, ₹500 Cr, ₹71.4 Cr, multiples & CAGR gauge
    await expect(page.locator('#valuation-chart svg')).toBeVisible();
    await expect(page.locator('#valuation-chart svg')).toContainText('₹250 Cr');
    await expect(page.locator('#valuation-chart svg')).toContainText('₹500 Cr');
    await expect(page.locator('#valuation-chart svg')).toContainText('27.8x ARR');

    const ladderOrderOk = await page.evaluate(() => {
      const svg = document.querySelector('#valuation-chart svg');
      if (!svg) return false;
      const getX = (label: string): number => {
        const el = Array.from(svg.querySelectorAll('text')).find(
          (t) => t.textContent?.trim() === label
        );
        return el ? Number(el.getAttribute('x')) : -1;
      };
      const xPre = getX('R1 Pre');
      const xAsk = getX('R1 Ask');
      const xPost = getX('R1 Post');
      const xR2 = getX('R2 Pre');
      return xPre > 0 && xPre < xAsk && xAsk < xPost && xPost < xR2;
    });
    expect(ladderOrderOk).toBe(true);

    await expect(page.locator('#revenue-chart svg')).toBeVisible();
    await expect(page.locator('#revenue-chart svg')).toContainText('₹71.4 Cr');
    await expect(page.locator('#revenue-chart svg')).toContainText('298%/yr CAGR');
    await expect(page.locator('#revenue-chart svg')).toContainText('Reachable ceiling');
    await expect(page.locator('#feasible-bar svg')).toBeVisible();

    await expect(page.locator('body')).not.toContainText('Backwards solver');
    await expect(page.locator('body')).not.toContainText('Includes a step-down below your dilution');
    await expect(page.locator('body')).not.toContainText('Growth steepness');

    await expect(page.locator('[data-metric-id="impliedPostMoney"]')).toHaveCount(0);
    await expect(page.locator('[data-metric-id="nextRoundPreMoney"]')).toHaveCount(0);
    await expect(page.locator('[data-metric-id="impliedCagrPct"] .l')).toContainText('Required CAGR');
    await expect(page.locator('[data-metric-id="impliedCagrPct"] .v')).toHaveText('298%/yr');
    await expect(page.locator('[data-metric-id="impliedCagrPct"] svg')).toBeVisible();
    await expect(page.locator('[data-metric-id="impliedPostRevenueMultiple"] .v')).toHaveText(
      '22.2x pre · 27.8x post'
    );
    await expect(page.locator('[data-metric-id="impliedPostRevenueMultiple"] svg')).toBeVisible();
    await expect(page.locator('[data-metric-id="fundingGap"] .v')).toHaveText('Not set');
    await expect(page.locator('#gs-output .sv')).toHaveText('₹18.9 Cr');

    // Verify Ask vs. Dilution Sensitivity Heatmap renders Reachable/Stretch/Stiff cells and one active cell
    await expect(page.locator('#heatmap-card')).toBeVisible();
    const hmCount = await page.locator('#heatmap-card button.vc-hm-cell').count();
    expect(hmCount).toBeGreaterThanOrEqual(20);
    expect(await page.locator('#heatmap-card button.vc-hm-cell--reachable').count()).toBeGreaterThan(0);
    expect(await page.locator('#heatmap-card button.vc-hm-cell--stretch').count()).toBeGreaterThan(0);
    expect(await page.locator('#heatmap-card button.vc-hm-cell--stiff').count()).toBeGreaterThan(0);
    await expect(page.locator('#heatmap-card button.vc-hm-cell[aria-current="true"]')).toHaveCount(1);
    await expect(page.locator('#heatmap-card button.vc-hm-cell[aria-current="true"]')).toContainText('298%/yr');

    // Ownership waterfall stays collapsed inside R0 & ESOP drawer by default
    await expect(page.locator('#ownership-waterfall')).toBeHidden();

    // Capture above-the-fold screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: 'docs/screenshot.png',
      fullPage: false,
    });

    // 6. Verify 5 ELI10 rules drawer & Sector Benchmarks clickable drawer
    await page.locator('#assumptions-drawer > summary').click();
    await expect(page.locator('#assumptions-drawer .vc-rule-item')).toHaveCount(5);

    await page.locator('#sector-benchmarks-drawer > summary').click();
    await page.locator('#sector-benchmarks-drawer button.vc-mult-pick', { hasText: '3.5x' }).click();
    await expect(page.locator('#mult')).toHaveValue('3.5');
    await expect(page.locator('#revenue-chart svg')).toContainText('₹142.9 Cr');

    // 7. Test Download XLSX triggers real PKZIP .xlsx file
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-xlsx-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('valuation-check-50-cr.xlsx');
    const stream = await download.createReadStream();
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const headerBytes = chunks[0]!;
    expect(headerBytes[0]).toBe(0x50);
    expect(headerBytes[1]).toBe(0x4b);
    expect(headerBytes[2]).toBe(0x03);
    expect(headerBytes[3]).toBe(0x04);

    // 7b. Click a Reachable cell in the heatmap -> applies Ask & Dilution and moves active highlight
    const reachCell = page.locator('#heatmap-card button.vc-hm-cell--reachable').first();
    const targetAsk = await reachCell.getAttribute('data-ask');
    const targetDil = await reachCell.getAttribute('data-dil');
    await reachCell.click();
    await expect(page.locator('#ask')).toHaveValue(targetAsk!);
    await expect(page.locator('#dil')).toHaveValue(targetDil!);
    await expect(page.locator('#vbadge')).toHaveText('Reachable');
    await expect(
      page.locator(`#heatmap-card button.vc-hm-cell[data-ask="${targetAsk}"][data-dil="${targetDil}"]`)
    ).toHaveAttribute('aria-current', 'true');

    // 7c. Expand R0 & ESOP drawer -> verify Ownership Waterfall SVG + live updates
    await page.locator('#settings-drawer > summary').click();
    await expect(page.locator('#ownership-waterfall svg')).toBeVisible();
    await expect(page.locator('#ownership-waterfall svg')).toContainText('Post R1');
    await expect(page.locator('#ownership-waterfall svg')).toContainText('Post R2');

    await page.locator('#dil').fill('20');
    await page.locator('#prior').fill('10');
    await page.locator('#r0-dil').fill('15');
    await page.locator('#esop').fill('10');
    await page.locator('#r2-dil').fill('20');
    await expect(page.locator('#ownership-waterfall svg')).toContainText('R0 round');
    await expect(page.locator('#ownership-waterfall svg')).toContainText('R1 ESOP');
    await expect(page.locator('#ownership-waterfall svg')).toContainText('59.5%');
    await expect(page.locator('#ownership-waterfall svg')).toContainText('47.6%');
    await expect(page.locator('#ownership-captable')).toContainText('10.5%');

    const badStyles = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[style]'))
        .filter((el) => (el.getAttribute('style') || '').trim().length > 0)
        .map((el) => `${el.tagName}#${el.id}.${String(el.className)}:${el.getAttribute('style')}`)
    );
    expect(badStyles).toEqual([]);
    const postDrawerText = await page.evaluate(() => document.body.innerText);
    expect(postDrawerText).not.toContain('—');

    // 8. Open Examples panel, switch to Example B, and test CAGR horizon sensitivity (18 mo vs 12 mo)
    await page.locator('#examples-panel > summary').click();
    await page.locator('button[data-id="b"]').click();
    await expect(page.locator('#vh')).toContainText('Reachable: 2.8x revenue growth needed in 18 months');
    await expect(page.locator('[data-metric-id="impliedPostRevenueMultiple"] .v')).toHaveText(
      '6.7x pre · 8.3x post'
    );
    await expect(page.locator('[data-metric-id="fundingGap"] .v')).toHaveText('₹20 Cr');
    await expect(page.locator('#burn-bar')).toBeVisible();

    await page.locator('#months').fill('12');
    await expect(page.locator('#vh')).toContainText('Stretch: 2.8x revenue growth needed in 12 months (178%/yr CAGR)');

    // 9. Switch to Example C, Goal-Seek Apply, and Unit Switcher
    await page.locator('button[data-id="c"]').click();
    await expect(page.locator('#vh')).toContainText('Stiff: 5.6x revenue growth needed');
    await expect(page.locator('#gs-output .sv')).toHaveText('₹81 Cr');
    await page.locator('#apply-goalseek-btn').click();
    await expect(page.locator('#vh')).toContainText('Reachable: 3x revenue growth needed');

    await page.locator('button[data-unit="INR_LAKH"]').click();
    await expect(page.locator('#ask')).toHaveValue('8100');

    // Verify 12% dilution triggers step-down 5% row alongside 12% (yours)
    await page.locator('#dil').fill('12');
    await expect(page.locator('#sens')).toContainText('5%');
    await expect(page.locator('#sens')).toContainText('12% (yours)');

    // 10. Verify zero horizontal overflow on mobile (390x844), including with Tools dropdown and (i) tooltip open
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(mobileOverflow).toBe(false);

    await page.locator('#nav-tools > summary').click();
    await expect(page.locator('#nav-tools')).toHaveAttribute('open', '');
    await expect(page.locator('#nav-tools .nav-dropdown__menu')).toBeVisible();
    const mobileOverflowOpen = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(mobileOverflowOpen).toBe(false);
    await page.locator('#nav-tools > summary').click();
    await expect(page.locator('#nav-tools')).not.toHaveAttribute('open', '');

    await page.locator('[aria-describedby="tip-mult"]').click();
    await expect(page.locator('#tip-mult')).toBeVisible();
    const mobileTooltipOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(mobileTooltipOverflow).toBe(false);
    await page.locator('h1').click();
  });
});
