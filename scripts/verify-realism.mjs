import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('verification/realism',{recursive:true});
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5187');await page.waitForFunction(()=>!!window.__derby);
 await page.evaluate(()=>{window.__derby.renderEnabled=false;window.__derby.start(true);});
 for(const [name,s,stage] of [['farmhouse',76,0],['barn-road',155,0],['woodland',360,0],['snow',155,1],['rain',155,3]]) {
   await page.evaluate(({s,stage})=>{window.__derby.setStage(stage);const r=window.__derby.racers[0];r.s=s;r.speed=0;window.__derby.controls.setButton('brake',true);window.__derby.renderEnabled=true;},{s,stage});
   await page.waitForTimeout(500);
   await page.screenshot({path:`verification/realism/${name}.png`});
   await page.evaluate(()=>window.__derby.renderEnabled=false);
 }
 assert.deepEqual(errors,[]);console.log('PASS: detailed environment renders in countryside, snow, and rain without browser errors.');
} finally {await browser.close();}
