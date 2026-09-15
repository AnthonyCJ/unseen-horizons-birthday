# Field Notes

A statically exported Next.js site published with GitHub Pages.

## Local checks

```text
npm ci
npm run check
npm run preview
```

The deployed site uses a client-side fragment gate to discourage casual access. It is not authentication, and the full access URL is intentionally not stored in this repository.

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
npx playwright install chromium webkit firefox
npm test
npm run test:browser:quick
npm run check:release
```

Build once (`npm run build`) before browser checks. The quick suite uses Chromium;
the full suite uses Chromium, WebKit and Firefox. It tests real PNG downloads,
4000-character and composition boundaries, 20 pages, resource cleanup, storage,
font and encoder failures, timeouts, cancellation, and narrow/short viewports.
Synthetic inputs and test entrances are used exclusively. Reports and downloaded
samples stay in ignored `test-results/` and `playwright-report/`, outside `out/`.
The Pages workflow runs these gates before uploading the same checked output.
Actual iPhone/Android keyboards and operating-system saving still need physical
device checks; viewport emulation does not establish that coverage.
