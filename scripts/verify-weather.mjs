import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('verification/weather',{recursive:true});
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
try {
const page=await browser.newPage({viewport:{width:1024,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5187');
await page.waitForFunction(()=>!!window.__derby);
await page.evaluate(()=>window.__derby.renderEnabled=false);
for (let stage=0;stage<4;stage++) {
 await page.evaluate(stage=>{window.__derby.setStage(stage);window.__derby.start(true);window.__derby.renderEnabled=true;},stage);
 await page.waitForTimeout(500);
 await page.screenshot({path:`verification/weather/stage-${stage}.png`});
 await page.evaluate(()=>window.__derby.renderEnabled=false);
 // Finish this run and return to the garage: the next scene must be selected.
 await page.evaluate(()=>{window.__derby.racers[0].s=3218;window.__derby.racers[0].finished=true;});
 await page.locator('#again').click();
 assert.equal(await page.evaluate(()=>window.__derby.stageIndex),(stage+1)%4);
}
assert.deepEqual(errors,[]);console.log('PASS: four rendered scenes, automatic scene cycling, no browser errors.');
}finally{await browser.close();}
