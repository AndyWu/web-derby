import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({args:['--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try {
 const context = await browser.newContext({viewport:{width:1024,height:768},hasTouch:true});
 await context.addInitScript(() => {
   localStorage.setItem('derby-controls-seen','1');
   window.motionRequests=0;
   for(const name of ['DeviceOrientationEvent','DeviceMotionEvent']) {
     window[name] ||= class {};
     window[name].requestPermission=()=>{window.motionRequests++;return Promise.resolve('granted');};
   }
 });
 const host=await context.newPage(), guest=await context.newPage();
 for(const page of [host,guest]) {
   await page.goto(process.env.DERBY_URL || 'http://127.0.0.1:5187');
   await page.waitForFunction(()=>!!window.__derby);
   await page.evaluate(()=>window.__derby.renderEnabled=false);
   await page.locator('#family-btn').click();
   assert.equal(await page.locator('#race-room').isDisabled(),true);
   await page.locator('#lobby-garage').click();
   await page.locator('[data-car=\"7\"]').click();
   await page.locator('#back').click();
   await page.locator('#lobby-tilt').click();
   assert.equal(await page.evaluate(()=>window.motionRequests),2);
   await page.evaluate(()=>{const e=new Event('deviceorientation');e.beta=60;e.gamma=0;window.dispatchEvent(e);});
   await page.waitForFunction(()=>document.querySelector('#lobby-tilt').textContent.includes('enabled'));
 }
 await host.locator('#lobby .stage-select').selectOption('3');
 await host.locator('#host').click();
 await host.waitForFunction(()=>document.querySelector('#code').value.startsWith('DERBY1:'));
 assert.equal(await host.locator('#race-room').isDisabled(),true);
 const offer=await host.locator('#code').inputValue();
 await guest.locator('#code').fill(offer);await guest.locator('#accept').click();
 await guest.waitForFunction(offer=>document.querySelector('#code').value!==offer,offer);
 const answer=await guest.locator('#code').inputValue();
 await host.locator('#code').fill(answer);await host.locator('#accept').click();
 await host.waitForFunction(()=>window.__derby.net.connectedCount===1);
 await guest.waitForFunction(()=>window.__derby.net.connectedCount===1);
 assert.equal(await host.locator('#race-room').isEnabled(),true);
 assert.equal(await guest.locator('#race-room').isDisabled(),true);
 await host.locator('#race-room').click();
 await guest.waitForFunction(()=>document.querySelector('#lobby').classList.contains('hidden'));
 assert.equal(await guest.evaluate(()=>window.__derby.racers.length),10);
 assert.equal(await guest.evaluate(()=>window.__derby.stageIndex),3);
 await host.waitForFunction(()=>window.__derby.startDelay>8);
 const before=await host.evaluate(()=>window.__derby.racers.map(r=>r.s));
 await host.waitForTimeout(1500);
 assert.deepEqual(await host.evaluate(()=>window.__derby.racers.map(r=>r.s)),before);
 assert.ok(await guest.locator('#race-countdown').isVisible());
 await host.waitForFunction(()=>window.__derby.startDelay===0,{},{timeout:15000});
 await host.waitForFunction(before=>window.__derby.racers[0].s>before[0]+.1,before);

 console.log('PASS: family tilt activation, solo-start guard, two-way connection, host starts both ten-car races.');
} finally {await browser.close();}
