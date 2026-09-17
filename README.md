# The Critical 90

Kaspersky campaign website, implemented from the current **KASPER WEB** desktop, responsive screens and UI kit.

**Live site:** https://imonsergey.github.io/The-Critical-90/

## Development

Node.js 22 or later. There are no application dependencies to install.

```sh
npm run build
npm run dev
```

Open `http://localhost:4173/The-Critical-90/`. Rebuild after changing source files. The output is a static `dist/` directory, suitable for GitHub Pages or any static host.

## Project structure

```
index.html                 Semantic page and dialog markup
src/styles.css             Shared tokens, components, responsive layout and transitions
src/main.js                Independent module initialization
src/motion.js              Reveal, pointer depth, light and reading progress
src/interactive.js         Navigation, accessible slide selector and dialogs
src/form.js                Validation and the submission adapter
src/content.js             Shared approved slide and timeline copy
src/config.js              Report URLs, form endpoint and timing configuration
public/assets/             Optimized artwork and native SVG from the design
public/brand-fonts.css      Official public Kaspersky webfont references
scripts/                   Static build and local preview
tests/browser_test.py     Browser regression tests (Python + Playwright)
```

## Design rules

The desktop composition is maintained at 1440px. Smaller screens reflow: the slider copy precedes one connected visual-and-controls module, cards change their column count, and the three timeline stages stack. Artwork is independently positioned behind the hero content, not inserted between the subtitle and actions.

The content `Button` and compact header `DownloadAction` are intentionally different. Header actions retain pill outlines and circular download icons. Reusable CSS components do not have copies for every screen width.

The UI uses Kaspersky Sans Display at weights 300, 400, 500 and 600 through verified public URLs on the official Kaspersky site. No font binaries are stored or redistributed by this repository. A self-hosted, licensed font delivery location can be substituted in `public/brand-fonts.css` by the production team.

## Interaction and motion

- The hero responds to a fine pointer through a damped spring; touch devices do not run pointer motion.
- Section reveals run once. Ambient depth is limited to visible elements. Scrolling remains native.
- Four distinct approved images are connected to the cyber-shift tabs. Arrow keys, Home/End and touch swipes are supported.
- Optional slide rotation pauses on hover, keyboard focus, hidden tabs, offscreen content and open dialogs. Manual selection stops rotation until Play is pressed.
- The header menu uses a native modal dialog with inert background, keyboard focus containment, Escape and focus restoration.
- The 30/60/90 cards expose focused stage details without inventing new report claims.
- `prefers-reduced-motion` disables parallax, entry transitions and automatic rotation.

## Integration settings

Edit `src/config.js`:

```js
reportUrl: '',       // Full, approved PDF URL
previewUrl: '',      // Approved preview PDF URL
formEndpoint: '',   // HTTPS POST endpoint accepting JSON
```

These addresses were not supplied with the design. They are deliberately empty. Until PDFs are connected, download controls open an interactive overview with a clear availability note. The consultation form validates normally but explicitly states that nothing was sent or stored. It never reports a successful submission without a successful HTTP response.

The form submits JSON only after valid required fields and privacy consent. A newsletter subscription is optional. There is a honeypot, timeout, duplicate-submit protection and a retry-friendly error state. No input is stored in localStorage or sessionStorage, and no analytics are installed.

The country list is generated locally from ISO identifiers through `Intl.DisplayNames`. Only the supplied English version is presented. Additional translations require approved copy and routes.

## Quality checks and deployment

```sh
npm run check
python -m pip install playwright
python -m playwright install chromium
npm run build
npm run test
```

The browser suite checks representative widths from 320px to 1920px, asset loading, horizontal overflow, menu focus and Escape, slide switching, form validation, reduced motion and no-JavaScript content. It saves screenshots and `test-results/report.json`.

GitHub Actions runs syntax, build and browser checks before publishing. Subsequent commits to `main` deploy automatically. The workflow uploads its screenshots as a separate artifact for review.

## Source design

Figma: https://www.figma.com/design/lQfOm1SOxe7rAnLQdeCfpA/GPT-ASTRA-TEST?node-id=704-3137

The supplied campaign artwork and trademarks remain the property of their respective rights holders. This repository does not grant a separate license to reuse them.
