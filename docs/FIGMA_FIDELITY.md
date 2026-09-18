# KASPER WEB implementation notes

Reference measured on 18 September 2026: Desktop `704:3137`; responsive frames `704:3377`, `704:3652`, `704:3930`, `704:4202`, `704:4475` in Figma file `lQfOm1SOxe7rAnLQdeCfpA`. The source design is unchanged.

## Layout

One semantic page, one set of components and descending composition breakpoints. `src/styles.css` contains component geometry and responsive rules. `public/polish.css` is a small interaction-only layer, not a second responsive stylesheet.

Figma cap-height trimming is represented by CSS `text-box` on the priority heading. The public webfont has slight shaping differences near three wrapping thresholds: the 640px priority title uses −0.2px tracking, the 960px title uses −0.4px, and narrow form descriptions use −0.1px. These small corrections preserve the approved copy and line counts instead of concealing excess height or applying offsets to later sections. The desktop framework title uses a 634px text box to preserve its two-line composition.

Hero and Priority use art-directed WebP exports of the actual visible Figma artwork at all six composition widths. There is no repeated-edge continuation or second masking layer. The 960px CTA children intentionally span 492px within a 430px copy column.

Hero motion operates inside a stationary, feathered viewport. Overscan follows the actual pointer/scroll displacement, returning to the source crop at rest. This prevents the opaque exported scene from exposing moving rectangular edges. The final CTA and consultation share the outer page-flow clip, allowing their native light and alpha-image fades to cross the section gap without a horizontal cut.

Why backgrounds and numbers use native Figma renders at each approved width. The original SVG exports are retained as source references; browser rendering of their Figma glass/inner-shadow filters was visibly flat, so the displayed numbers use lossless WebP with alpha. Framework uses the source SVG grid, source gradient/inner-shadow values, backdrop blur and the measured stroked halo. Browser glass approximates Figma refraction; it is not a claim of pixel identity. CTA uses source crop positions and proportional scaling. Why masks and consultation backgrounds use isolated alpha exports (contentsOnly), so their edges preserve the native fade instead of embedding the page background into a rectangle.

## Interaction

A single scheduled motion frame batches pointer geometry reads before style writes. Fine-pointer input drives bounded hero depth, subtle ambient offsets and button-content magnetism. Intersection observers stop offscreen motion; live reduced-motion changes cancel running effects. There is no scroll hijacking or WebGL dependency.

The responsive menu temporarily hosts the real header controls: there is no duplicate language state or duplicate control ID. Native dialogs retain keyboard containment, Escape and focus restoration. Slide transitions are interruptible, with keyboard, touch swipe, autoplay, pause and reduced-motion support. Timeline halo emphasis is shared by pointer and keyboard focus.

## Verification and integration

`browser_test.py`: 11 widths, image/font readiness, overflow, menu keyboard behavior, slide controls, touch swipe, timeline dialogs, missing-PDF state and no submission without an endpoint.

`visual_review.py`: geometry snapshots for component and section boxes, six full-page and hero captures, source-based section y/height tolerance of 4px and container-width tolerance of 2px. The child regression fixture also verifies both CTA rectangles, unclipped 24px icons, label separation, exact H1 line strings, visible artwork bounds and Why number bounds against Figma (2px). Screenshots remain necessary; passing geometry is not a pixel-perfect claim.

`public_smoke.py`: verifies the deployed Git SHA and unauthenticated public rendering at 320px and 1440px after Pages publishes. `build.json` identifies the revision; local CSS and module imports are revision-versioned to avoid mixed cached builds.

Download PDF URLs and the submission endpoint remain explicit configuration in `src/config.js`. A missing integration shows an honest unavailable/preview state; it does not report a successful download or save personal data.

## Branch preservation

The continuation started from `dee2e03b44c52f1edcdd5aec701b878a9ec51c33`. Independent main commit `c91308ad45c21e6923f46704bac7049eb85e4626` was integrated as a second parent of `111c4616871b308c6decd168a754fa950144ffc4`. Both diagnostic scripts and workflow steps are retained. No force update or wholesale replacement of either branch was used.
