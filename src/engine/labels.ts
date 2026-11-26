export const REVIEWED_DATE = 'Nov 2026';

export const LABELS = {
  reviewedDate: REVIEWED_DATE,
  ruleOfThumbTag: `Rule of thumb · reviewed ${REVIEWED_DATE}`,
  benchmarkSourceLine:
    'Where these numbers come from: common early-stage India and global VC round-sizing heuristics (20 to 25% dilution, 2x step-up, 15 to 18 month runway), not formal market data.',
  introFraming: 'Enter your round. See whether the price is justifiable.',
  pricingCheckTitle: 'Pricing check',
  resultDisclaimer: 'Illustrative sanity check, not a valuation or advice.',
  bands: {
    reachable: 'Conservative',
    stretch: 'Stretch',
    stiff: 'Aggressive',
    invalid: 'Check inputs',
    incomplete: 'Pre-revenue',
  },
  pricingThresholdsLine: (reachCagrStr: string, stretchCagrStr: string): string =>
    `Pricing bands: Conservative (≤${reachCagrStr} required CAGR) · Stretch (${reachCagrStr} to ${stretchCagrStr}) · Aggressive (>${stretchCagrStr})`,
  headline: (growthStr: string, monthsStr: string): string =>
    `Needs ${growthStr} revenue in ${monthsStr} months to justify this price.`,
  preRevenueHeadline: 'Revenue multiples do not fit pre-revenue rounds.',
  preRevenueMessage:
    'ARR is 0, so revenue-multiple pricing does not apply. Pre-revenue and TRL 3 to 6 DeepTech rounds are priced on milestones instead (DeepTech Round Planner coming soon).',
  esopNoteDefault:
    "Any ESOP pool created this round comes out of pre-money, reducing existing shareholders' effective valuation and stake while R1 investors keep their target stake.",
  esopNoteActive: (
    pctStr: string,
    poolMoneyStr: string,
    preMoneyStr: string,
    effPreMoneyStr: string,
    dilStr: string
  ): string =>
    `The ${pctStr} ESOP pool (${poolMoneyStr}) comes out of your ${preMoneyStr} headline pre-money, leaving existing holders an effective pre-money of ${effPreMoneyStr} while new R1 investors keep ${dilStr}.`,
  indiaNotesTitle: 'India notes',
  indiaNotesTag: 'FEMA & Fair Value',
  indiaNotesAsOf: `As of ${REVIEWED_DATE}`,
  indiaNotes: [
    {
      title: 'Sizing heuristic only',
      body: 'This ask-and-dilution math is a venture-sizing check, not a certified fair valuation under Indian company or tax law.',
    },
    {
      title: 'FEMA floor for foreign capital',
      body: 'Issue prices to non-resident investors must generally clear a fair market value floor certified by a SEBI-registered merchant banker, Chartered Accountant, or cost accountant.',
    },
    {
      title: 'Draft 2026 RBI rules',
      body: "RBI's draft 2026 foreign-investment pricing framework may alter valuation methods, validity windows, or filing rules once notified.",
    },
    {
      title: 'Not legal advice',
      body: 'Verify current FEMA, Companies Act, and tax pricing rules with qualified Indian counsel before fixing term-sheet share prices.',
    },
  ],
} as const;
