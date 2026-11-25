# Valuation Check

**Test a startup fundraise ask backwards from what the next round (`R2`) must pay.**

Live at [funding.kanishkamohan.com/tools/valuation-check/](https://funding.kanishkamohan.com/tools/valuation-check/).

![Valuation Check Screenshot](./docs/screenshot.png)

## What It Is

Even without quoting a valuation on a slide, a fundraise **Ask** in this round (`R1`) sets your implied valuation (`Ask ÷ Dilution`). Institutional investors test that price backwards from whether the next round (`R2`) can pay at least **2x** in **15 to 18 months**.

- **100% Client-Side & Private:** Runs entirely inside your browser. No accounts, no backend calls, and nothing you enter leaves your device.
- **R0 -> R1 -> R2 Flow:** Checks optional prior round (`R0`) and pre-money ESOP dilution, sizes `R1` valuation and burn plan, and computes the required `R2` ARR, CAGR, and CMGR.
- **Visual Charts & Multiple Shift:** Plots the **Valuation Ladder** (`R1 Pre -> R1 Ask -> R1 Post -> R2 Pre`), **Revenue Bridge**, **Required CAGR Gauge**, **Valuation Multiple Shift**, and **Feasible Ask Scale**.
- **Goal-Seek & Dilution Sensitivity:** Solves backwards for max `R1` ask, required revenue, or `R1` dilution, and shows dilution sensitivity including a lower step-down row.
- **Excel Export:** Exports inputs, live Excel formulas, rules of thumb, and indicative sector revenue multiples to a client-side `.xlsx` workbook.

## How to Run Locally

Requires [Node.js](https://nodejs.org/) (v18+ recommended).

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run pure calculation engine unit & acceptance tests (Vitest)
npm test

# Type-check and build production bundle (outputs dist/)
npm run build

# Run end-to-end browser verification (Playwright)
npm run test:e2e
```

## Credit & Disclaimer

- **Conceptual Inspiration:** Based on [Sajith Pai's note on startup fundraise asks](https://www.linkedin.com/pulse/rookie-fundraising-mistake-even-some-experienced-founders-sajith-pai-nvl2c/).
- **Part of:** [funding.kanishkamohan.com](https://funding.kanishkamohan.com/) · TheKanishkaMohan.
- **Disclaimer:** Independent thinking aid. Not affiliated with or endorsed by Sajith Pai or Blume Ventures. Not financial, investment, or legal advice.

## License

Released under the [MIT License](./LICENSE).
