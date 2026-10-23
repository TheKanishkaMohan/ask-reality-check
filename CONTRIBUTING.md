# Contributing to Ask Reality Check

Contributions, bug reports, and improvements are welcome! Please follow these standing rules when opening an issue or pull request:

1. **Pure Calculation Engine (`src/engine`):** Keep all financial maths inside `src/engine` with zero DOM or browser globals. Every new calculation or edge case must include unit tests in `tests/engine.test.ts`.
2. **Traceability & Honesty on Assumptions:** Every number shown in the UI must include an expandable formula trace (`How this is calculated`) and explicitly distinguish rules from the source article vs. tool assumptions (`docs/ask-check-method.md`).
3. **100% Client-Side Privacy:** Never add analytics, tracking pixels, external font trackers, or network requests that transmit user inputs.
4. **No Private Data:** Never include real private company names, client figures, or personal contact data in presets, tests, or documentation. Use clearly hypothetical examples.
5. **Checks Before Committing:**
   ```bash
   npm test
   npm run build
   ```
