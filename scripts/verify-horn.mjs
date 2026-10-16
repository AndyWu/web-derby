import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
try {
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
 await page.addInitScript(()=>{window.hornTones=0;const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){const tone=original.call(this);const start=tone.start.bind(tone);tone.start=(...args)=>{if(tone.type==='sawtooth' && tone.frequency.value>=300 && tone.frequency.value<=450)window.hornTones++;return start(...args);};return tone;};});
 await page.goto('http://127.0.0.1:5187');await page.waitForFunction(()=>!!window.__derby);
 await page.evaluate(()=>{window.__derby.renderEnabled=false;window.__derby.start(true);});
 page.on('pageerror',e=>console.log('ERROR',e.message));
 await page.waitForTimeout(500);
 const before=await page.evaluate(()=>window.hornTones);
 await page.locator('#dashboard-horn').tap();
 console.log(await page.evaluate(()=>({tones:window.hornTones,running:window.__derby.running}))); 
 await page.waitForFunction(before=>window.hornTones>=before+2,before);
 const rect=await page.locator('#dashboard-horn').boundingBox();assert.ok(rect.width>=44&&rect.height>=44&&rect.x>=0&&rect.x+rect.width<=844);
 await page.waitForTimeout(400);const after=await page.evaluate(()=>window.hornTones);await page.keyboard.press('h');
 await page.waitForFunction(after=>window.hornTones>=after+2,after);
 console.log('PASS: touch and H key sound the two-tone horn; dashboard target fits landscape phone.');
}finally{await browser.close();}
