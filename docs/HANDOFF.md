# The Critical 90 — implementation notes

## Source of truth

Figma: `lQfOm1SOxe7rAnLQdeCfpA`, page `KASPER WEB`.
The current Desktop is `704:3137`. Responsive screens are in `704:3376`, header references in `704:4750`, and UI-kit in `704:5082`.
The older Responsive Screens section is not the implementation reference.

## Structure

- `public/index.html`: semantic, fully server-readable page content and component markup.
- `public/styles.css`: tokens, shared controls, section layouts, responsive rules and reduced-motion styling.
- `public/app.js`: Navigation, ShiftCarousel, pointer materials, reading progress, timeline selection, document preview and consultation validation.
- `public/site-config.js`: the only place for client URLs and the consultation endpoint.
- `public/assets/`: stable, exported design assets. No temporary Figma asset URLs are used by the site.
- `scripts/build.py`: creates `dist/` and optimizes the oversized CTA image without modifying the master.
- `scripts/test_site.py`: browser checks and screenshot capture at nine viewport widths.

The site uses native ES modules and CSS, with no client-side framework or animation-library dependency. Layout is not duplicated by breakpoint. It remains readable without JavaScript. No trackers, cookies or local storage are installed.

## Layout

The content width is capped at 1328 px. Side margins follow the reference sizes: 56 / 48 / 40 / 28 / 24 / 20 px. The desktop hero remains a two-column composition; below 768 px its artwork sits behind and below the copy. The image is not placed after the buttons as an extra flow item.

At desktop width the cyber-shifts copy and controls sit beside the image. At intermediate widths the introduction spans the row and the image stays connected to the control grid. At small widths the media and controls become a single vertical module. The four cards use one state model.

Content buttons and header download pills intentionally use different geometry. The former use 240 × 52 px by default and fill narrow columns. Header pills retain the supplied 165 × 32 and 155 × 32 px dimensions.

## Interaction

- Navigation: fixed header, scroll-progress line, active-section indication, anchor links, focus-contained overlay, Escape and backdrop dismissal.
- Slider: crossfade, four different current artworks, keyboard arrows/Home/End, pointer swipe, previous/next, explicit play/pause, visibility-aware timer, pause on hover/focus. Manual choice pauses rotation.
- Surfaces: very small perspective changes and pointer-local light. Touch devices do not get mouse-only effects.
- Timeline: three selectable stages with keyboard controls and a live-region announcement.
- Motion: IntersectionObserver reveals, transform/opacity transitions, small image parallax. No scroll hijacking or scroll pinning. Reduced motion removes ambient and entrance animation and starts the slider paused.

## Required before a production launch

Populate `reportUrl`, `previewUrl` and `formEndpoint` in `public/site-config.js` with client-approved destinations. The form currently validates locally and explicitly says it has not sent personal data; it never simulates a successful submission. The document dialog displays the existing approved site content but is not represented as the complete report.

The live consultation endpoint must accept a JSON POST, support CORS for the final site origin, validate and rate-limit requests server-side, and return a 2xx response only after accepting the request. Newsletter consent is separate and optional. No API secrets belong in this static site.

Only English content has been provided. The language control therefore identifies the current language instead of fabricating translated pages. More Reports leads to the official Kaspersky resources page.

Web typography references the existing public Kaspersky font endpoints directly. No font files are copied or redistributed. The client should supply an approved, durable font delivery location for the production domain. Arial is the fallback when the remote font is unavailable.

`noindex` is intentional for this review deployment. Remove it, update the canonical/OG metadata, and change `robots.txt` when the final documents and backend are approved.

## Run and publish

Python 3 and Pillow are needed for the build. `python -m pip install pillow playwright` and `python -m playwright install chromium` prepare local build/QA tools.

`npm run dev` serves the source at http://localhost:4173. `npm run build` creates `dist`. For QA, set `SITE_URL` to the served location and run `npm test`.

The Pages workflow checks JavaScript syntax, builds, tests at 320/375/480/640/768/960/1200/1440/1920 px, uploads review screenshots, and deploys only after those checks pass. All static URLs are relative so the `/The-Critical-90/` project path works without rewrites.
