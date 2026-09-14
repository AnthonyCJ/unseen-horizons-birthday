import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { loadPostcard, POSTCARD_SOURCE } from '../../lib/postcard.mjs';
import render from '../../lib/postcard-render.json' with { type: 'json' };

test('keeps the postcard PNG in sync with its complete source, font files and artwork', async () => {
  for (const [file, hash] of Object.entries(render.files)) {
    const bytes = await readFile(new URL(`../../${file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, `Regenerate the postcard and render record after changing ${file}`);
  }
});

test('saves the actual 1800 by 1200 PNG with the same bytes used by the preview', async () => {
  const bytes = await readFile(new URL('../../public/keepsakes/unknown-horizons-2026.png', import.meta.url));
  assert.equal(bytes.readUInt32BE(16), 1800);
  assert.equal(bytes.readUInt32BE(20), 1200);
  let requested;
  const blob = await loadPostcard(async (url) => { requested = url; return new Response(bytes); });
  assert.equal(requested, POSTCARD_SOURCE);
  assert.equal(blob.type, 'image/png');
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), bytes);
  assert.deepEqual((await readdir(new URL('../../public/assets/', import.meta.url))).sort(), [
    'healing-003.jpg', 'healing-004.jpg', 'healing-008.jpg', 'sky-castle-ocarina.mp3',
  ]);
});

test('rejects unavailable files and HTML error pages instead of saving a broken PNG', async () => {
  await assert.rejects(loadPostcard(async () => new Response('Unavailable', { status: 503 })));
  await assert.rejects(loadPostcard(async () => new Response('<html>Not found</html>')));
  await assert.rejects(loadPostcard(async () => { throw new TypeError('Network failure'); }));
});

test('passes cancellation to the download request so closing a preview can stop it', async () => {
  const controller = new AbortController();
  controller.abort();
  let observed;
  await assert.rejects(loadPostcard(async (_url, options) => {
    observed = options.signal;
    options.signal.throwIfAborted();
  }, controller.signal));
  assert.equal(observed, controller.signal);
});
