# Browser compatibility checks

Run `npm run check:release` before delivering a new version. It includes source
checks, the production build, export/font checks and the entire browser suite.
`npm run test:compatibility` runs the added compatibility cases against an
already built `out/`. `npm run test:browser` also includes all existing question
card and postcard regression cases. The Pages workflow runs that same suite
before uploading the build. Updating local workflow files does not run CI.

## Coverage and priority

- Desktop defaults: a 1440 × 900 screen with a 1440 × 800 content viewport,
  plus the full-height viewport, both at DPR 2.
- Large desktop: 1920 × 1200 screen, 1920 × 1080/full-height viewports at DPR 1.
- Additional display settings, small windows and supplemental mobile viewports
  are enumerated in `../compatibility-profiles.mjs`.
- The normal-speed first-visit test runs the complete five-page sequence in
  every engine, including the original letter reveal and replay. Additional
  normal-motion cases check modal/reader continuity and dynamic preferences.
- Reduced-motion layout cases cover the complete navigable content at every
  profile. Fault cases cover storage, clipboard, assets, fonts, downloads and
  stalled/rejected music startup. Existing export cases verify actual PNG bytes.
- Keyboard cases check focus containment, return focus, Home and arrow keys;
  wheel input checks long reader text and the bottom of an image preview.
  Delayed-response cases add 200 ms to matched local assets without pretending
  to reproduce a particular network speed or device performance.

## What these results mean

The screen/viewport separation, toolbar allowances and DPR are test inputs,
not measurements of a particular computer. The 125/150/200-percent reflow
profiles emulate the available layout space, not browser UI zoom. Mobile
contexts enable touch; Firefox supports the viewport test but not Playwright's
`isMobile` option. None of these claims a physical phone, virtual keyboard,
trackpad, external-display switch, system clipboard or photo-album test.

WebKit is a test build, not the Safari application. Windows/Linux WebKit cannot
prove macOS media, font or OS integration behavior. Tests attach engine/UA,
viewport, DPR, motion preference and media-capability evidence. The full journey
asserts native audio playback when that build advertises MP3 support; otherwise
it records the limitation and checks usable error feedback. Hardware sound
quality and real Safari remain separate validation items.

Tests use isolated contexts and a synthetic entrance available only in the
loopback test server. Do not load a private entrance or reuse personal browser
profiles. Motion preferences are set per context; the server must not force
reduced motion globally. Test failures stop the existing release workflow;
there are no unconditional skips for target desktop cases.

The local default is one worker. Keep it for the Windows WebKit build: running
multiple headless instances can add substantial startup delays on this host.
CI keeps its existing two-worker setting on Linux; its actual runtime and result
must be checked when the workflow is next authorized to run.
