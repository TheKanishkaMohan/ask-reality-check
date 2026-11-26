import { expect, test } from '@playwright/test';

test.describe('Valuation Check v0.5 — Canonical Units, Results First, ESOP, Burn, India Notes & XLSX', () => {
  test('verifies Results First layout, canonical unit round-trips, same-company samples, ESOP, optional burn, India notes, XLSX & responsive fit', async ({
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

    await page.setViewportSize({ width: 1280, height: 960 });
    await page.goto('/');
    expect(new URL(page.url()).search).toBe('');

    // 1. Topbar, Nav Dropdown, Hero & Footer consistency
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
        hasText: 'DeepTech Round Planner',
      })
    ).toContainText('Soon');
    await page.keyboard.press('Escape');
    await expect(page.locator('#nav-tools')).not.toHaveAttribute('open', '');

    await expect(page.locator('h1')).toHaveText('Valuation Check');
    await expect(page.locator('.vc-hero-lead')).toHaveText(
      'Enter your round. See whether the price is justifiable.'
    );
    await expect(page.locator('.vc-credit-footnote')).toHaveText(
      'Calculations run inside your browser; nothing leaves your device. Thanks to Sajith Pai for inspiring this tool.'
    );
    await expect(page.locator('#download-xlsx-btn')).toHaveText('Download XLSX');

    // 2. Inputs First Layout (Configuration ABOVE Pricing check), On-this-page nav, "See your result ↓", Sticky Strip & Disclaimer
    await expect(page.locator('.vc-jump-nav')).toContainText('On this page');
    for (const label of ['Result', 'Ladder', 'Solver', 'Sensitivity', 'Rules', 'India notes']) {
      await expect(page.locator('.vc-jump-nav .vc-jump-link', { hasText: label })).toBeVisible();
    }

    const configBox = await page.locator('#config-card').boundingBox();
    const verdictBox = await page.locator('#verdict-box').boundingBox();
    expect(configBox).not.toBeNull();
    expect(verdictBox).not.toBeNull();
    expect(configBox!.y).toBeLessThan(verdictBox!.y);

    // Sticky result strip is hidden while inputs are in view
    await expect(page.locator('#sticky-result-strip')).toBeHidden();
    await expect(page.locator('#see-result-btn')).toHaveText('See your result ↓');

    // Scroll down past #config-card so sticky strip appears and test clicking it
    await page.locator('#see-result-btn').click();
    await page.waitForTimeout(80);
    await expect(page.locator('#sticky-result-strip')).toBeVisible();
    await expect(page.locator('#sticky-badge')).toHaveText('Conservative');
    await expect(page.locator('#sticky-summary')).toHaveText(
      '· 2.4x growth in 18 mo · ₹100 Cr post'
    );

    // Clicking sticky strip jumps back to #verdict-box cleanly
    await page.locator('#heatmap-card').scrollIntoViewIfNeeded();
    await page.locator('#sticky-result-link').click();
    const verdictAfterJump = await page.locator('#verdict-box').boundingBox();
    expect(verdictAfterJump).not.toBeNull();
    expect(Math.abs(verdictAfterJump!.y)).toBeLessThan(200);

    // Scroll back to top for default desktop screenshot & checks
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('#sticky-result-strip')).toBeHidden();

    // Check R0 panel badge is clean ("Optional", no "80% R1")
    await expect(page.locator('#settings-summary-chip')).toHaveText('Optional');

    // Check Pricing check card, headline, disclaimer placement, stats, ESOP note & thresholds
    await expect(page.locator('#verdict-box .vc-eyebrow')).toHaveText('Pricing check');
    await expect(page.locator('#vbadge')).toHaveText('Conservative');
    await expect(page.locator('#vh')).toHaveText(
      'Needs 2.4x revenue in 18 months to justify this price.'
    );
    await expect(page.locator('#vdisclaimer')).toHaveText(
      'Illustrative sanity check, not a valuation or advice.'
    );
    const vhBox = await page.locator('#vh').boundingBox();
    const discBox = await page.locator('#vdisclaimer').boundingBox();
    const statsBox = await page.locator('#verdict-stats').boundingBox();
    expect(vhBox && discBox && statsBox).not.toBeNull();
    expect(vhBox!.y).toBeLessThan(discBox!.y);
    expect(discBox!.y).toBeLessThan(statsBox!.y);

    await expect(page.locator('#verdict-stats')).toContainText('78%/yr');
    await expect(page.locator('#verdict-stats')).toContainText('₹100 Cr');
    await expect(page.locator('#verdict-stats')).toContainText('Effective pre-money');
    await expect(page.locator('#verdict-stats')).toContainText('₹80 Cr');
    await expect(page.locator('#verdict-stats')).toContainText('Founder stake (Post R1)');
    await expect(page.locator('#verdict-stats')).toContainText('80%');
    await expect(page.locator('#verdict-esop-note')).toContainText('comes out of pre-money');
    await expect(page.locator('#verdict-box')).toContainText('Rule of thumb · reviewed Nov 2026');
    await expect(page.locator('#verdict-box')).toContainText('Where these numbers come from:');

    // Clean rounded sensitivity grid steps (15, 20, 30, 40, 50 Cr; no 42 or 53 Cr)
    const hmRowHeaders = await page.locator('#heatmap-card tbody th.vc-hm-row-head').allInnerTexts();
    const hmTextJoined = hmRowHeaders.join(' | ');
    for (const expectedAsk of ['₹15 Cr', '₹20 Cr', '₹30 Cr', '₹40 Cr', '₹50 Cr']) {
      expect(hmTextJoined).toContain(expectedAsk);
    }
    expect(hmTextJoined).not.toContain('₹42 Cr');
    expect(hmTextJoined).not.toContain('₹53 Cr');

    // Label clarity & hygiene assertions (never call CAGR conservative/stretch; zero em-dashes)
    const initialBodyAndSvg = await page.evaluate(() => {
      const text = document.body.innerText;
      const svgText = Array.from(document.querySelectorAll('svg'))
        .map((s) => (s.textContent || '') + ' ' + (s.getAttribute('aria-label') || ''))
        .join(' ');
      return `${text}\n${svgText}`;
    });
    expect(initialBodyAndSvg).not.toContain('—');
    expect(initialBodyAndSvg).not.toContain('VC Benchmark');
    expect(initialBodyAndSvg).not.toContain('VC benchmark');
    expect(initialBodyAndSvg).not.toContain('Tool Assumption');
    expect(initialBodyAndSvg).not.toContain('Tool assumption');
    expect(initialBodyAndSvg).not.toContain('Add revenue');
    expect(initialBodyAndSvg).not.toContain('Enter revenue');
    expect(initialBodyAndSvg).not.toMatch(/(conservative|stretch)\s+(cagr|growth|ceiling)/i);
    expect(await page.locator('.vc-config-card .chip', { hasText: 'Assumption' }).count()).toBe(0);

    // Optional burn bar & burn signal card hidden when #burn is empty by default
    await expect(page.locator('#burn')).toHaveValue('');
    await expect(page.locator('#burn-bar')).toBeHidden();
    await expect(page.locator('[data-metric-id="fundingGap"]')).toHaveCount(0);

    // Capture desktop screenshot (above the fold shows framing, inputs + See your result button)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'docs/screenshot.png', fullPage: false });
    await page.screenshot({
      path: 'C:/Users/kanis/.gemini/antigravity/brain/babe7b45-2138-4629-8cfa-6fad6934b238/scratch/vc-v06-desktop.png',
      fullPage: false,
    });

    // 3. Canonical unit round-trip: Cr -> USD ($M) -> FX edit -> Lakh -> Cr
    await expect(page.locator('#fx-wrap')).toBeHidden();
    await page.locator('button[data-unit="USD_M"]').click();
    await expect(page.locator('#fx-wrap')).toBeVisible();
    await expect(page.locator('#fx-rate')).toHaveValue('85');
    const usdAsk = Number(await page.locator('#ask').inputValue());
    expect(usdAsk).toBeCloseTo(20 / 8.5, 3);
    await expect(page.locator('#verdict-stats')).toContainText('$11.8M');

    // Download XLSX in USD ($M) at FX 85 before changing FX
    const dlUsdPromise = page.waitForEvent('download');
    await page.locator('#download-xlsx-btn').click();
    const dlUsd = await dlUsdPromise;
    expect(dlUsd.suggestedFilename()).toBe('valuation-check-2.35-usd-m.xlsx');

    // Update FX to 90 -> canonical ₹20 Cr preserved, USD displays update ($2.22M, $11.1M post)
    await page.locator('#fx-rate').fill('90');
    const usdAsk90 = Number(await page.locator('#ask').inputValue());
    expect(usdAsk90).toBeCloseTo(20 / 9, 3);
    await expect(page.locator('#verdict-stats')).toContainText('$11.1M');

    // Switch to Lakh -> ₹2,000 Lakh, then back to Cr -> exact original 20, 12, 1
    await page.locator('button[data-unit="INR_LAKH"]').click();
    await expect(page.locator('#fx-wrap')).toBeHidden();
    await expect(page.locator('#ask')).toHaveValue('2000');
    await expect(page.locator('#rev')).toHaveValue('1200');
    await expect(page.locator('#mrr')).toHaveValue('100');

    await page.locator('button[data-unit="INR_CR"]').click();
    await expect(page.locator('#ask')).toHaveValue('20');
    await expect(page.locator('#rev')).toHaveValue('12');
    await expect(page.locator('#mrr')).toHaveValue('1');

    // Reset FX back to 85 cleanly via reload or direct change (keeping Cr default clean after presets)
    await page.goto('/');

    // 4. Same-company samples (₹20 / ₹30 / ₹50 Cr) land in all 3 bands
    await page.locator('button[data-id="a"]').click();
    await expect(page.locator('#vbadge')).toHaveText('Conservative');
    await expect(page.locator('#verdict-stats')).toContainText('78%/yr');

    await page.locator('button[data-id="b"]').click();
    expect(new URL(page.url()).search).toBe('?p=b');
    await expect(page.locator('#vbadge')).toHaveText('Stretch');
    await expect(page.locator('#vh')).toHaveText(
      'Needs 3.6x revenue in 18 months to justify this price.'
    );
    await expect(page.locator('#verdict-stats')).toContainText('134%/yr');

    await page.locator('button[data-id="c"]').click();
    expect(new URL(page.url()).search).toBe('?p=c');
    await expect(page.locator('#vbadge')).toHaveText('Aggressive');
    await expect(page.locator('#vh')).toHaveText(
      'Needs 6x revenue in 18 months to justify this price.'
    );
    await expect(page.locator('#verdict-stats')).toContainText('228%/yr');

    // Back to default preset a for ESOP & Burn checks
    await page.locator('button[data-id="a"]').click();

    // 5. ESOP lives in main Config inputs and updates Effective pre-money & Founder stake
    await expect(page.locator('.vc-config-card #esop')).toBeVisible();
    await page.locator('#esop').fill('10');
    await expect(page.locator('#verdict-stats')).toContainText('₹70 Cr');
    await expect(page.locator('#verdict-stats')).toContainText('70%');
    await expect(page.locator('#verdict-esop-note')).toContainText('₹10 Cr');
    await expect(page.locator('#verdict-esop-note')).toContainText('₹70 Cr');
    await page.locator('#esop').fill('0');

    // 6. Optional Monthly Net Burn shows burn bar + card when entered and hides when cleared
    await page.locator('#burn').fill('2');
    await expect(page.locator('#burn-cash-readout')).toContainText('₹36 Cr');
    await expect(page.locator('#burn-bar')).toBeVisible();
    await expect(page.locator('#burn-bar')).toContainText('Shortfall: ₹16 Cr');
    await expect(page.locator('[data-metric-id="fundingGap"] .v')).toHaveText('₹16 Cr');
    await page.locator('#burn').fill('');
    await expect(page.locator('#burn-bar')).toBeHidden();
    await expect(page.locator('[data-metric-id="fundingGap"]')).toHaveCount(0);

    // 7. Sector multiples button applies to R2 multiple
    await page.locator('#sector-benchmarks-drawer > summary').click();
    await page.locator('#sector-benchmarks-drawer button.vc-mult-pick', { hasText: '3.5x' }).click();
    await expect(page.locator('#mult')).toHaveValue('3.5');
    await expect(page.locator('#revenue-chart svg')).toContainText('₹57.1 Cr');

    // 8. India notes drawer starts collapsed, displays "As of Nov 2026", and shows FEMA / merchant banker / Draft 2026 rules / not legal advice
    await expect(page.locator('#india-notes-drawer')).not.toHaveAttribute('open', '');
    await expect(page.locator('#india-notes-drawer > summary')).toContainText('As of Nov 2026');
    await page.locator('#india-notes-drawer > summary').click();
    await expect(page.locator('#india-notes-drawer')).toHaveAttribute('open', '');
    await expect(page.locator('#india-notes-drawer')).toContainText('As of Nov 2026');
    await expect(page.locator('#india-notes-drawer')).toContainText('certified fair valuation');
    await expect(page.locator('#india-notes-drawer')).toContainText('SEBI-registered merchant banker');
    await expect(page.locator('#india-notes-drawer')).toContainText('draft 2026');
    await expect(page.locator('#india-notes-drawer')).toContainText('Not legal advice');

    // 9. ARR = 0 shows Pre-revenue & DeepTech pointer
    await page.locator('#rev').fill('0');
    await expect(page.locator('#vbadge')).toHaveText('Pre-revenue');
    await expect(page.locator('#verdict-prerev-callout')).toBeVisible();
    await expect(page.locator('#verdict-prerev-callout')).toContainText(
      'DeepTech Round Planner coming soon'
    );
    await page.locator('#rev').fill('12');

    // 10. Goal-Seek Apply, Heatmap cell click, Shareable URL reload & Validation edge cases
    await page.locator('button[data-id="c"]').click();
    await expect(page.locator('#gs-output .sv')).toHaveText('₹25.2 Cr');
    await page.locator('#apply-goalseek-btn').click();
    await expect(page.locator('#vbadge')).toHaveText('Conservative');

    const reachCell = page.locator('#heatmap-card button.vc-hm-cell--reachable').first();
    const cellAsk = await reachCell.getAttribute('data-ask');
    await reachCell.click();
    await expect(page.locator('#ask')).toHaveValue(cellAsk!);

    // URL reload in USD ($M) with custom FX 90 preserves exact model
    await page.goto('/?p=b&u=USD_M&fx=90');
    await expect(page.locator('#fx-rate')).toHaveValue('90');
    const reloadedAsk = Number(await page.locator('#ask').inputValue());
    expect(reloadedAsk).toBeCloseTo(30 / 9, 3);
    await expect(page.locator('#vbadge')).toHaveText('Stretch');

    // Validation messages
    await page.locator('#dil').fill('0');
    await expect(page.locator('#vbadge')).toHaveText('Check inputs');
    await expect(page.locator('#err-dil')).toBeVisible();
    await page.locator('#dil').fill('100');
    await expect(page.locator('#err-dil')).toBeVisible();
    await page.locator('#dil').fill('20');
    await page.locator('#months').fill('0');
    await expect(page.locator('#err-months')).toBeVisible();
    await page.locator('#months').fill('18');
    await page.locator('#mult').fill('0');
    await expect(page.locator('#err-mult')).toBeVisible();

    // Return to clean default for mobile visual inspection & overflow checks
    await page.goto('/');

    // Download XLSX in INR Cr
    const dlCrPromise = page.waitForEvent('download');
    await page.locator('#download-xlsx-btn').click();
    const dlCr = await dlCrPromise;
    expect(dlCr.suggestedFilename()).toBe('valuation-check-20-cr.xlsx');

    // 11. Strict CSP style check + em-dash check + mobile overflow check (390px, 375px and 360px) + sticky strip on 375px
    const badStyles = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[style]'))
        .filter((el) => (el.getAttribute('style') || '').trim().length > 0)
        .map((el) => `${el.tagName}#${el.id}`)
    );
    expect(badStyles).toEqual([]);
    expect(externalRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    for (const width of [1280, 390, 375, 360]) {
      await page.setViewportSize({ width, height: 780 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);
      const gridOverflow = await page.evaluate(() => {
        const wrap = document.querySelector('#heatmap-wrap');
        return wrap ? wrap.scrollWidth > wrap.clientWidth + 1 : true;
      });
      expect(gridOverflow).toBe(false);
    }

    // 375px mobile: inputs above results, sticky strip appears cleanly on scroll as single line
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('button[data-id="b"]').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    const mConfigBox = await page.locator('#config-card').boundingBox();
    const mVerdictBox = await page.locator('#verdict-box').boundingBox();
    expect(mConfigBox!.y).toBeLessThan(mVerdictBox!.y);
    await page.screenshot({
      path: 'C:/Users/kanis/.gemini/antigravity/brain/babe7b45-2138-4629-8cfa-6fad6934b238/scratch/vc-v06-mobile375.png',
      fullPage: false,
    });

    await page.locator('#verdict-box').scrollIntoViewIfNeeded();
    await expect(page.locator('#sticky-result-strip')).toBeVisible();
    await expect(page.locator('#sticky-badge')).toHaveText('Stretch');
    await expect(page.locator('#sticky-summary')).toContainText('3.6x growth in 18 mo · ₹150 Cr post');
    const stickyBox = await page.locator('#sticky-result-strip').boundingBox();
    expect(stickyBox).not.toBeNull();
    expect(stickyBox!.height).toBeLessThanOrEqual(60);
    const mobileStickyOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(mobileStickyOverflow).toBe(false);
    await page.screenshot({
      path: 'C:/Users/kanis/.gemini/antigravity/brain/babe7b45-2138-4629-8cfa-6fad6934b238/scratch/vc-v06-mobile375-sticky.png',
      fullPage: false,
    });
  });
});
