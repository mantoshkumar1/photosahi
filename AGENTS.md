# PhotoSahi repository instructions

## Required verification

Run `npm run verify` after every code or content change.

## Discovery and SEO source of truth

- `config.js` is the shared source of truth for presets, supported formats, canonical URL, public descriptions, features, limitations, and FAQs.
- Do not hand-edit generated content between the `SEO` or `DISCOVERY_CONTENT` markers in `index.html`.
- Do not hand-edit `robots.txt`, `sitemap.xml`, `llms.txt`, or `assets/seo-manifest.json`.
- When application behavior, presets, supported formats, privacy behavior, public URL, limitations, or user-facing capabilities change, update `config.js` and run `npm run seo:generate`.
- `npm run seo:check` must pass before merging. It intentionally fails when reliability-critical source files changed without regenerating discovery outputs.
- Keep descriptions factual. Never promise compliance, approval, or acceptance by an issuing authority.
- Do not add personal photo fixtures. Regression tests must use deterministic mocks or synthetic data.
