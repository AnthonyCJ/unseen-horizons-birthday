import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import font from "../lib/postcard-font-license.json" with { type: "json" };

const root = new URL("../", import.meta.url);
const sourceFile = "scripts/postcard.html";
const imageFile = "public/assets/healing-008.jpg";
const outputFile = "public/keepsakes/unknown-horizons-2026.png";
const sources = new Map([
  ["/postcard-source.html", [sourceFile, "text/html; charset=utf-8"]],
  [`/unseen-horizons-birthday/${font.file.replace(/^public\//, "")}`, [font.file, "font/woff2"]],
  ["/unseen-horizons-birthday/assets/healing-008.jpg", [imageFile, "image/jpeg"]],
]);
const responses = new Map(await Promise.all([...sources].map(async ([url, [file, type]]) => [url, { body: await readFile(new URL(file, root)), type }])));
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  const asset = responses.get(path);
  if (!asset) { response.writeHead(404).end(); return; }
  response.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-store" });
  response.end(asset.body);
});
let browser;
try {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/postcard-source.html`);
  await page.locator('.postcard-sheet[data-fonts-ready="true"]').waitFor({ timeout: 15000 });
  const geometry = await page.evaluate(() => {
    const canvas = document.querySelector("#birthday-postcard-note").getBoundingClientRect();
    const sheet = document.querySelector(".postcard-sheet").getBoundingClientRect();
    const name = document.querySelector(".postcard-recipient").getBoundingClientRect();
    const signature = document.querySelector(".postcard-signature").getBoundingClientRect();
    const mark = document.querySelector(".postcard-smile-mark").getBoundingClientRect();
    const eyes = document.querySelector(".postcard-smile-eyes").getBoundingClientRect();
    const mouth = document.querySelector(".postcard-smile-mouth").getBoundingClientRect();
    const smileSize = parseFloat(getComputedStyle(document.querySelector(".postcard-smile")).fontSize);
    const overflow = [...document.querySelectorAll(".postcard-photo,.postcard-name,.postcard-wish-line,.postcard-smile-mark,.postcard-signature,.postcard-date")].filter(element => {
      const box = element.getBoundingClientRect();
      return box.left < sheet.left || box.right > sheet.right || box.top < sheet.top || box.bottom > sheet.bottom;
    }).map(element => element.className);
    return {
      width: canvas.width, height: canvas.height,
      card: { left: sheet.left, top: sheet.top, width: sheet.width, height: sheet.height },
      smile: { bounds: mark.toJSON(), fontSize: smileSize, eyeMouthAdvanceEm: (mouth.top - eyes.top) / smileSize, boxAspectRatio: mark.height / mark.width },
      signatureCenterDifference: Math.abs(name.left + name.width / 2 - signature.left - signature.width / 2), overflow,
    };
  });
  const card = geometry.card;
  if (geometry.width !== 1800 || geometry.height !== 1200 || geometry.signatureCenterDifference > .25 || geometry.overflow.length ||
      card.left < 20 || card.top < 12 || card.left + card.width > 1780 || card.top + card.height > 1182 ||
      Math.abs(card.width / card.height - 1.5) > .001 ||
      Math.abs(geometry.smile.eyeMouthAdvanceEm - .5) > .002 || Math.abs(geometry.smile.boxAspectRatio - 1.5) > .002) {
    throw new Error(`Postcard layout failed: ${JSON.stringify(geometry)}`);
  }
  const png = await page.screenshot({ type: "png", animations: "disabled" });
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || png.readUInt32BE(16) !== 1800 || png.readUInt32BE(20) !== 1200) {
    throw new Error("Renderer did not produce the expected complete PNG");
  }
  await writeFile(new URL(outputFile, root), png);
  const paths = [sourceFile, "scripts/render-postcard.mjs", font.file, imageFile, outputFile];
  const files = Object.fromEntries(await Promise.all(paths.map(async file => [file, createHash("sha256").update(await readFile(new URL(file, root))).digest("hex")])));
  const record = { width: 1800, height: 1200, design: "B · 生日来信", paperEdge: "Thin cardstock with a narrow surround, lit upper edge, visible paper side and soft contact shadow", smile: "Original full-width page-05 glyphs with explicit half-em eye-to-mouth advance; independent of browser punctuation trimming", handwritingFamily: "Birthday Postcard Ink", font: font.family, renderedWithFontsLoaded: true, geometry, files, capture: `Lossless Chromium ${browser.version()} PNG. Fonts and artwork loaded; signature and smile geometry checked; device scale factor 1; no resizing or recompression.` };
  await writeFile(new URL("lib/postcard-render.json", root), `${JSON.stringify(record, null, 2)}\n`);
  console.log(JSON.stringify({ output: outputFile, bytes: png.length, ...geometry }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
