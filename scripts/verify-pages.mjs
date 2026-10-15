import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.DERBY_URL || 'http://127.0.0.1:4176/web-derby/';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const timeout=setTimeout(()=>process.exit(2),90000);
try {
 const context=await browser.newContext({viewport:{width:844,height:390}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(base);assert.equal(response.status(),200);
 await page.waitForFunction(()=>!!window.__derby);
 await page.evaluate(()=>window.__derby.renderEnabled=false);
 const state=await page.evaluate(async()=>{
  const registration=await navigator.serviceWorker.ready;
  const manifest=await (await fetch(new URL('manifest.json',location.href))).json();
  const cacheManifest=await (await fetch(new URL('cache-manifest.json',location.href))).json();
  return {scope:registration.scope,manifest,assets:cacheManifest.assets,keys:await caches.keys()};
 });
 assert.equal(state.scope,base);
 assert.ok(state.assets.every(path=>!path.startsWith('/')));
 assert.equal(state.manifest.start_url,'./');
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);
 await page.reload();await page.waitForFunction(()=>!!window.__derby);
 await page.evaluate(()=>{window.__derby.renderEnabled=false;window.__derby.start(true);});
 assert.equal(await page.evaluate(()=>window.__derby.racers.length),10);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({url:base,online:true,offlineReload:true,cars:10,scope:state.scope,cacheCount:state.keys.length,errors}));
}finally{await browser.close();clearTimeout(timeout);}
