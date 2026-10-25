import { test, expect } from "@playwright/test";
import { ENTRANCE, scene, openFinding, nextFinding, assertLayout, recordEnvironment } from "./compatibility-helpers.mjs";
import { assertApprovedCopy, recordCopyLayout } from "./copy-helpers.mjs";
import { LETTER_PHRASES } from "../approved-copy.mjs";

for (const viewport of [{width:1440,height:800},{width:1920,height:1080},{width:390,height:744}]) {
  test(`approved copy and native music timeline ${viewport.width} @copy-rhythm`, async ({browser,baseURL},info) => {
    test.setTimeout(150000);
    const context=await browser.newContext({baseURL,viewport,reducedMotion:'no-preference'});
    const page=await context.newPage();
    try {
      await page.goto(ENTRANCE);
      await scene(page,1);
      await assertApprovedCopy(page,'cover');
      await expect(page.locator('.scene-actions')).toHaveCSS('opacity','1',{timeout:15000});
      await page.evaluate(() => {
        window.__copySamples=[];
        window.__copyTimer=setInterval(()=>{
          const stage=document.querySelector('.stage');
          const audio=document.querySelector('audio');
          const runs=[...document.querySelectorAll('.letter-copy .character-reveal')];
          window.__copySamples.push({time:performance.now(),page:stage?.dataset.page,audio:audio?.currentTime,paused:audio?.paused,runs:runs.map(el=>{
            const chars=[...el.querySelectorAll('.character')];
            return {text:el.getAttribute('aria-label'),visible:chars.filter(c=>Number(getComputedStyle(c).opacity)>.05).length,complete:chars.every(c=>Number(getComputedStyle(c).opacity)>.99),total:chars.length};
          })});
        },80);
      });
      await page.getByRole('button',{name:'翻开手记',exact:true}).click();
      await expect(page.locator('.stage')).toHaveAttribute('data-page','2');
      await expect(page.locator('.stage')).toHaveAttribute('data-page','3',{timeout:23000});
      await expect(page.locator('.letter-closing .character').last()).toHaveCSS('opacity','1',{timeout:60000});
      await expect.poll(() => page.evaluate(() => window.__copySamples.some(s =>
        s.runs.some(r => r.text === '落满日常。' && r.complete)))).toBe(true);
      await assertApprovedCopy(page,'letter');
      await assertLayout(page,info,'normal-letter');
      await recordCopyLayout(page,info,'normal-letter');
      const evidence=await page.evaluate(()=>{
        clearInterval(window.__copyTimer);
        const audio=document.querySelector('audio');
        const syncAdjustment=parseFloat(getComputedStyle(document.querySelector('.letter-scene')).getPropertyValue('--letter-sync-adjustment'));
        const phrases=[...document.querySelectorAll('.letter-body .character-reveal')].map(el=>{
          const chars=[...el.querySelectorAll('.character')];
          const first=getComputedStyle(chars[0]),last=getComputedStyle(chars.at(-1));
          return {text:el.getAttribute('aria-label'),start:parseFloat(first.animationDelay)*1000,end:(parseFloat(last.animationDelay)+parseFloat(last.animationDuration))*1000};
        });
        return {samples:window.__copySamples,phrases,syncAdjustment,audio:{codec:audio.canPlayType('audio/mpeg'),time:audio.currentTime,paused:audio.paused,error:audio.error?.code??null}};
      });
      await info.attach('copy-music-timeline',{contentType:'application/json',body:JSON.stringify(evidence,null,2)});
      await recordEnvironment(page,info,{scenario:'normal animation with native media; timing tolerance is sampling tolerance, not a changed product schedule'});
      expect(evidence.phrases.map(p=>p.text)).toEqual(LETTER_PHRASES.map(p=>p.text));
      for(let i=0;i<LETTER_PHRASES.length;i++) {
        // The existing player compensates for scene handoff latency. Compare
        // its unshifted schedule, then independently verify real audio below.
        expect(evidence.phrases[i].start-evidence.syncAdjustment).toBeCloseTo(LETTER_PHRASES[i].delay,0);
        expect(evidence.phrases[i].end-evidence.syncAdjustment).toBeCloseTo(LETTER_PHRASES[i].delay+LETTER_PHRASES[i].duration,0);
      }
      expect(evidence.audio.codec,'Native MP3 decoding is required for this timing case').not.toBe('');
      expect(evidence.audio.error).toBeNull();
      expect(evidence.audio.paused).toBe(false);
      const firstLetter=evidence.samples.find(s=>s.page==='3');
      expect(firstLetter.audio).toBeGreaterThan(14.5);
      expect(firstLetter.audio).toBeLessThan(17.2);
      const greeting=evidence.samples.find(s=>s.runs.some(r=>r.text==='生日快乐，Charlotte。'&&r.visible>0));
      expect(greeting.audio).toBeGreaterThan(20);
      expect(greeting.audio).toBeLessThan(23);
      for(const phrase of LETTER_PHRASES) {
        const start=evidence.samples.find(s=>s.runs.some(r=>r.text===phrase.text&&r.visible>0));
        const end=evidence.samples.find(s=>s.runs.some(r=>r.text===phrase.text&&r.complete));
        expect(start,phrase.text+' appears').toBeTruthy();
        expect(end,phrase.text+' finishes').toBeTruthy();
        expect(Math.abs(start.audio-(15.6+phrase.delay/1000)),phrase.text+' follows music').toBeLessThan(2);
        expect(Math.abs(end.audio-(15.6+(phrase.delay+phrase.duration)/1000)),phrase.text+' completes in its window').toBeLessThan(2);
      }
      await page.screenshot({path:info.outputPath('letter-normal.png'),fullPage:true});
      await page.getByRole('button',{name:'继续翻阅',exact:true}).click();
      await scene(page,4);
      await openFinding(page,1);
      await assertApprovedCopy(page,'method');
      await recordCopyLayout(page,info,'method-normal');
      await page.screenshot({path:info.outputPath('method-normal.png'),fullPage:true});
      await nextFinding(page);
      await assertApprovedCopy(page,'attention');
      await recordCopyLayout(page,info,'attention-normal');
      await page.screenshot({path:info.outputPath('attention-normal.png'),fullPage:true});
    } finally { await context.close(); }
  });
}
