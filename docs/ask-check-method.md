# Ask Reality Check — Method & Formula Reference

## 1. Core Premise

This document specifies the mathematical model used by **Ask Reality Check**, based on Sajith Pai's published note, [*"The rookie fundraising mistake that even some experienced founders make!"*](https://www.linkedin.com/pulse/rookie-fundraising-mistake-even-some-experienced-founders-sajith-pai-nvl2c/) (October 2026).

**The principle in one line:** Even if a founder never quotes a valuation, quoting a fundraise **Ask** immediately signals an implied post-money valuation ($\text{Ask} \div \text{Dilution}$), and an institutional VC evaluates that valuation backwards from whether the *next* round can pay at least $2\times$ for it in 15–18 months.

---

## 2. Inputs

| Symbol | Input Field | Default | Description |
|---|---|---|---|
| $A$ | `ask` | — | Amount the founder is looking to raise in the current round |
| $d$ | `dilutionPct` | $20\%$ | Equity dilution in this round ($0\% < d < 100\%$; early-stage benchmark: $20\%\text{–}25\%$) |
| $R_0$ | `annualRevenue` | — | Current annualised revenue ($\text{ARR} = 12 \times \text{MRR}_0$) |
| $M_0$ | `monthlyRevenue` | — | Current monthly revenue ($R_0 \div 12$) |
| $P_{\text{prior}}$ | `priorRaise` | $0$ | Capital raised in the immediate previous round ($0$ if none) |
| $\text{priced}_{\text{prior}}$ | `priorRaiseWasPriced` | `true` | Whether the previous raise was a priced institutional/angel round (vs. grant or unpriced note) |
| $S$ | `stepUpMultiple` | $2.0\times$ | Required valuation step-up from this round's post-money to next round's pre-money |
| $k_{\text{next}}$ | `nextRoundMultiple` | $7.0\times$ | Expected next-round pre-money valuation to annualised revenue multiple |
| $T$ | `monthsToNextRound` | $18$ | Months to reach the next round's milestone (benchmark: $15\text{–}18$ months) |
| $C$ | `cashNeeded` | $0$ | Total cash required from burn plan to reach the next round's milestone ($0$ if not specified) |
| $e$ | `esopTopUpPct` | $0\%$ | Pre-money ESOP pool top-up required by incoming investors, expressed as $\%$ of post-money ($d + e < 100\%$) |

---

## 3. Forward Calculation Chain

### 3.1 Implied Valuation Today

$$\text{Implied Post-Money } (V_{\text{post}}) = \frac{A}{d / 100}$$

$$\text{Implied Pre-Money } (V_{\text{pre}}) = V_{\text{post}} - A = V_{\text{post}} \times \left(1 - \frac{d}{100}\right)$$

At the standard $20\%\text{–}25\%$ early-stage dilution band, $V_{\text{post}}$ is $4\times\text{ to }5\times$ the ask $A$. At $33.33\%$ dilution (very high for early stage), $V_{\text{post}}$ is $3\times$ the ask.

### 3.2 Pre-Money ESOP Pool Adjustment

When a VC requires an ESOP pool top-up of $e\%$ of post-money to be created *pre-money*, that pool reduces the effective valuation attributable to existing shareholders:

$$\text{Effective Pre-Money } (V_{\text{pre, eff}}) = V_{\text{pre}} - V_{\text{post}} \times \left(\frac{e}{100}\right) = V_{\text{post}} \times \left(1 - \frac{d + e}{100}\right)$$

*Constraint:* $d + e < 100\%$.

### 3.3 Current Revenue Multiples (Post-Money vs. Pre-Money)

In venture parlance, some investors quote revenue multiples on post-money and others on pre-money (for instance, Example B in the article refers to ₹80 Cr pre-money on ₹12 Cr ARR as *"~7x revenue multiple"* while ₹100 Cr post-money on ₹12 Cr ARR is $8.33\times$). The engine computes both explicitly:

$$\text{Implied Post-Money Multiple } (k_{\text{post}}) = \frac{V_{\text{post}}}{R_0}$$

$$\text{Implied Pre-Money Multiple } (k_{\text{pre}}) = \frac{V_{\text{pre}}}{R_0}$$

### 3.4 Backwards Induction from the Next Round

To underwrite the current round, the incoming investor needs the next round's pre-money valuation ($V_{\text{next, pre}}$) to be at least $S\times$ (typically $2\times$) the current post-money valuation within $T$ months:

$$\text{Next-Round Pre-Money } (V_{\text{next, pre}}) = V_{\text{post}} \times S$$

Given the expected next-round revenue multiple $k_{\text{next}}$ (accounting for round-to-round multiple compression):

$$\text{Required Next-Round Annualised Revenue } (R_1) = \frac{V_{\text{next, pre}}}{k_{\text{next}}}$$

$$\text{Required Next-Round Monthly Revenue } (M_1) = \frac{R_1}{12}$$

### 3.5 Required Growth & Implied CAGR

$$\text{Required Growth Multiple } (G) = \frac{R_1}{R_0} = \frac{k_{\text{post}} \times S}{k_{\text{next}}}$$

Notice the structural identity: whenever $k_{\text{post}} > k_{\text{next}}$ (multiple compression), required revenue growth $G$ must exceed the valuation step-up $S$.

Over a horizon of $T$ months, the compound annual growth rate (CAGR) and compound monthly growth rate (CMGR) are:

$$\text{Implied Annual CAGR} = G^{(12 / T)} - 1$$

$$\text{Implied Monthly CMGR} = G^{(1 / T)} - 1$$

### 3.6 Milestone Funding Gap & Previous Raise Ratio

If the founder enters the cash needed $C$ from their burn plan to reach $R_1$:

$$\text{Funding Shortfall} = \max(0, C - A)$$

$$\text{Runway Buffer} = \max(0, A - C) \quad (\text{when } C > 0)$$

If a previous priced raise $P_{\text{prior}} > 0$ exists:

$$\text{Ask vs. Previous Raise Ratio} = \frac{A}{P_{\text{prior}}}$$

The article notes that realistic asks typically fall within **$3\times\text{ to }4\times$** the previous priced raise.

---

## 4. Goal-Seek Equations

For any target maximum growth ceiling $G_{\max}$ (e.g., $3.0\times$ for a reachable target or $5.0\times$ for a stretch target):

1. **Maximum Defensible Ask ($A_{\max}$):**
   $$A_{\max} = R_0 \times G_{\max} \times k_{\text{next}} \times \frac{d / 100}{S}$$

2. **Required Current Annualised Revenue ($R_{0,\text{req}}$) to justify Ask $A$:**
   $$R_{0,\text{req}} = \frac{A \times S}{(d / 100) \times k_{\text{next}} \times G_{\max}}$$

3. **Required Dilution ($d_{\text{req}}\%$) for Ask $A$ and Revenue $R_0$ to clear $G_{\max}$:**
   $$d_{\text{req}}\% = \frac{A \times S}{R_0 \times G_{\max} \times k_{\text{next}}} \times 100$$

---

## 5. Worked Examples from the Article (Acceptance Benchmarks)

| Example | Scenario in Article | Inputs | Exact Engine Output | Article Text (Rounded) |
|---|---|---|---|---|
| **A** | ₹50 Cr ask on ₹75L/mo revenue | $A=50$, $d=20\%$, $R_0=9$, $S=2$, $k_{\text{next}}=7^*$ | $V_{\text{post}} = \text{₹250 Cr}$ ($d=20\%$) or $\text{₹200 Cr}$ ($d=25\%$) or $\text{₹151.5 Cr}$ ($d=33\%$); $V_{\text{next,pre}} = \text{₹500 Cr}$; $R_1 = \text{₹71.4 Cr}$; $G = 7.94\times$ | ₹200–250 Cr post-money (₹150 Cr at 33%); ₹500 Cr+ next round pre-money |
| **B** | Consumer brand sized to milestone | $A=20$, $d=20\%$, $R_0=12$ (₹1 Cr/mo), $S=2$, $k_{\text{next}}=6$, $C=40$ | $V_{\text{post}} = \text{₹100 Cr}$, $V_{\text{pre}} = \text{₹80 Cr}$, $k_{\text{pre}} = 6.67\times$, $k_{\text{post}} = 8.33\times$, $V_{\text{next,pre}} = \text{₹200 Cr}$, $R_1 = \text{₹33.33 Cr}$ ($\text{₹2.78 Cr/mo}$), $G = 2.78\times$, Shortfall $= \text{₹20 Cr}$ | ₹80 Cr pre (~7x), ₹100 Cr post; ₹200 Cr next pre at 6x $\rightarrow$ ~₹35 Cr ARR (~₹3 Cr/mo); ₹40 Cr burn leaves ₹20 Cr shortfall |
| **C** | Cautionary ₹150 Cr consumer services pitch | $A=150$, $d=25\%$, $R_0=18$ (₹1.5 Cr/mo), $S=2$, $k_{\text{next}}=12$ | $V_{\text{post}} = \text{₹600 Cr}$ ($d=25\%$) or $\text{₹750 Cr}$ ($d=20\%$); $V_{\text{next,pre}} = \text{₹1,200 Cr}$; $R_1 = \text{₹100 Cr}$; $G = 5.56\times$ | ₹600–750 Cr post-money; ₹1,200+ Cr next round; close to ₹100 Cr ARR, roughly 5.5x growth ("Stiff") |

*\*Note: In Example A, the article leaves next-round multiple open ("?"); $7\times$ is used as our explicit placeholder assumption.*

---

## 8. Origin Table: Source Article vs. Tool Assumptions

Every rule of thumb and default in the tool is categorized below and labeled in the UI.

| Parameter / Rule | Default Value | Origin | Notes |
|---|---|---|---|
| Standard early-stage dilution band | $20\%\text{–}25\%$ ($4\text{–}5\times$ ask) | **Source Article** | Explicitly stated by Sajith Pai; $33\%$ noted as high-dilution edge case |
| Minimum next-round valuation step-up ($S$) | $2.0\times$ post-money | **Source Article** | *"We want the next round's pre-money valuation to be at least 2x the present post-money valuation"* |
| Benchmark time to next round ($T$) | $15\text{–}18$ months | **Source Article** | Seed/early-stage convention from the article |
| Ask vs. previous priced raise band | $3.0\times\text{–}4.0\times$ | **Source Article** | *"Typically, the asks tend to be 3 to 4x of the previous raise"* |
| Pre-money ESOP pool top-up impact | Reduces effective pre-money | **Source Article (Comments)** | Highlighted by Adityavikram Banka & confirmed by Sajith Pai in comment thread |
| Verdict growth band: **Reachable** | $\le 3.0\times$ in 15–18 mo | **Our Assumption** | Derived from Example B ($\sim 2.8\times\text{–}3\times$ growth treated as baseline milestone) |
| Verdict growth band: **Stretch** | $> 3.0\times$ to $\le 5.0\times$ | **Our Assumption** | Interpolated between Example B ($\sim 3\times$) and Example C ($5.5\times$) |
| Verdict growth band: **Stiff** | $> 5.0\times$ in 15–18 mo | **Our Assumption** | Derived from Example C ($5.56\times$ growth explicitly called *"Stiff"*) |
| Example A next-round multiple | $7.0\times$ ARR | **Our Assumption** | Placeholder to complete the table shown in the article's hero graphic |
| Annualised CAGR formula | $G^{(12/T)} - 1$ | **Our Assumption** | Standard compound annualisation over $T$ months |
