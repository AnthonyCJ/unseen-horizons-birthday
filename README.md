# Field Notes

A statically exported Next.js site published with GitHub Pages.

## Local checks

```text
npm ci
npm run check
npm run preview
```

The deployed site uses a client-side fragment gate to discourage casual access. It is not authentication, and the full access URL is intentionally not stored in this repository.

All local acceptance URLs for this project must serve the same current `out/`
directory in the live project. Build and verify the latest working tree before
acceptance; an isolated build is not delivered until its verified output is
promoted to that directory. Other local preview ports must reference that same
output instead of serving historical copies. Verify the files returned by every
running project preview, including the user's normal port, against the promoted
build. Existing tabs need a user-initiated reload to load a new build; do not clear
drafts or reload the user's tabs as part of a content update.

## Temporary drafts and image export

Editable card text stays in the current tab's `sessionStorage`; it is never sent
to a shared service. Reloading the same tab can restore it. Session restoration
can also restore a draft, so this is neither a long-term archive nor a guarantee
of erasure on closing the browser. Use the clear action for explicit removal.
Preview and normal visits have separate draft keys. Reading progress remains
independent. When storage fails, editing and image generation continue in memory
with a visible warning; failed removal is reported and can be retried.

Blank and filled cards are generated in the browser and shown before download.
Long text is split across images without truncation. Downloading does not clear
the draft or confirm that the browser actually saved a file. Saved files are
managed by their owner. There is no content account, database, synchronization
endpoint, or editable cross-device history.

For a loopback-only review using a synthetic entrance, run
`npm run preview -- --test-key` and use the URL it prints. The response substitutes
the test digest only in memory; production files and the real entrance stay intact.
Append `--reduced-motion` for faster interaction checks. Ordinary `npm run preview`
continues to use the production entrance.

## Question-card checks and font status

The page 04 paper note accepts 4,000 grapheme clusters (including spaces and
newlines); a combined emoji counts as one. CRLF/CR become LF. Invalid or oversized
edits are rejected in full, composition is validated on commit, and the last valid
draft remains. A separate 256 KiB UTF-8 guard bounds pathological combining text.

PNG output is 1200 × 1600, with at most 20 pages. Layout preserves literal
whitespace and paragraph breaks; a whitespace-only draft becomes one blank card.
Pages are rendered on demand, retaining at most the current page and neighbours.
Font waiting is bounded at 8 seconds, PNG encoding at 10 seconds. Closing or
editing invalidates the previous work. Errors offer retry, a readable text image,
or copying the complete draft. Device fallback glyphs are disclosed in the UI.

The accepted 0.4.4 question-card design uses Maoken Ying Bi Kai Shu 0.20
(Chinese, renamed as Birthday Question Kai) with Kalam Regular 2.001
(Latin, renamed as Birthday Question Latin). The fixed postcard uses Long Cang.
The selected WOFF2 files include OFL 1.1 licenses and copyright notices.
`npm run verify:question-fonts` checks the recorded embedding permission,
resource hashes, licenses, and notices for the selected question-card and
postcard fonts.

Character coverage is recorded in `lib/question-font-coverage.json`. Characters
missing from the selected fonts use device fallback with a visible notice;
coverage is not universal, and a mapped code point does not guarantee a matching
handwritten style. Font selection does not change the input limits, static
postcard, or five-screen experience.

Local acceptance and automated engine checks do not establish physical-device
coverage or deployment status. Check the actual release run before describing a
version as published.

```text
# Use the installed Google Chrome for the release checks.
npx playwright install webkit
npm run check:release
```

Build once (`npm run build`) before browser checks. The quick suite uses Chromium;
the full suite uses Chromium, WebKit and Firefox. It tests real PNG downloads,
4000-character and composition boundaries, 20 pages, resource cleanup, storage,
font and encoder failures, timeouts, cancellation, and narrow/short viewports.
Synthetic inputs and test entrances are used exclusively. Reports and downloaded
samples stay in ignored `test-results/` and `playwright-report/`, outside `out/`.
The Pages workflow and `check:release` use the bounded Chrome/WebKit suite in
`playwright.release.config.mjs`: recorded desktop/mobile sizes, the five-page
journey, reader replay, bilingual Prompt, draft recovery and keepsake downloads,
zoom and returns. Run it with `npm run test:release` after building `out/`.
Only the checked output is uploaded. The broader suite remains separately
available; Firefox is not part of this release gate. Chrome is the actual branded
browser; WebKit results do not certify the Safari application. Clipboard payload
and fallback checks do not establish native operating-system pasting.
Actual iPhone/Android keyboards and operating-system saving still need physical
device checks; viewport emulation does not establish that coverage.
