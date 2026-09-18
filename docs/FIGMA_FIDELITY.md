# KASPER WEB implementation notes

Reference measured on 18 September 2026: Desktop `704:3137`; responsive frames `704:3377`, `704:3652`, `704:3930`, `704:4202`, `704:4475` in Figma file `lQfOm1SOxe7rAnLQdeCfpA`. The source design is unchanged.

## Layout

One semantic page, one set of components and descending composition breakpoints. `src/styles.css` contains component geometry and responsive rules. `public/polish.css` is a small interaction-only layer, not a second responsive stylesheet.

Figma cap-height trimming is represented by CSS `text-box` on the priority heading. The public webfont has slight shaping differences near three wrapping thresholds: the 640px priority title uses −0.2px tracking, and narrow form descriptions use −0.1px. These small corrections preserve the approved copy and line counts instead of concealing excess height or applying offsets to later sections. The desktop framework title uses a 634px text box to preserve its two-line composition.

Hero image-fill crops were compared visually. The mobile background continuation repeats only the raster's rightmost background column; it does not stretch the numeral. The 90 DAYS illustration retains vector paths, gradients and the source's inner-shadow material.

## Interaction

A single scheduled motion frame batches pointer geometry reads before style writes. Fine-pointer input drives bounded hero depth, subtle ambient offsets and button-content magnetism. Intersection observers stop offscreen motion; live reduced-motion changes cancel running effects. There is no scroll hijacking or WebGL dependency.

The responsive menu temporarily hosts the real header controls: there is no duplicate language state or duplicate control ID. Native dialogs retain keyboard containment, Escape and focus restoration. Slide transitions are interruptible, with keyboard, touch swipe, autoplay, pause and reduced-motion support. Timeline halo emphasis is shared by pointer and keyboard focus.

## Verification and integration

`browser_test.py`: 11 widths, image/font readiness, overflow, menu keyboard behavior, slide controls, touch swipe, timeline dialogs, missing-PDF state and no submission without an endpoint.

`visual_review.py`: geometry snapshots for component and section boxes, six full-page and hero captures, source-based section y/height tolerance of 4px and container-width tolerance of 2px. Screenshots remain necessary; passing geometry is not a pixel-perfect claim.

`public_smoke.py`: verifies the deployed Git SHA and unauthenticated public rendering at 320px and 1440px after Pages publishes. `build.json` identifies the revision; local CSS and module imports are revision-versioned to avoid mixed cached builds.

Download PDF URLs and the submission endpoint remain explicit configuration in `src/config.js`. A missing integration shows an honest unavailable/preview state; it does not report a successful download or save personal data.
