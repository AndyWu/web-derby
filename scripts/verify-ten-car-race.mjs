import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const output='verification/ten-car-race';await mkdir(output,{recursive:true});
const base=process.env.DERBY_URL||'http://localhost:5176';
const hardStop=setTimeout(()=>process.exit(2),180000);
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const result={errors:[]};
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>!!window.__derby);
 await page.evaluate(()=>window.__derby.renderEnabled=false);
 assert.match(await page.locator('#home').innerText(),/Est\. 1975/i);
 assert.match(await page.locator('#home').innerText(),/Ten drivers\. Two miles\. Nothing but gravity\./);
 await page.locator('#garage-btn').click();
 const names=await page.locator('[data-car]').allTextContents();
 assert.equal(names.length,12);
 for(const removed of ['Thunder Pumpkin','Rustbucket','Blackberry Jam'])assert.ok(!names.includes(removed));
 result.garage=names;
 assert.equal(await page.locator('[data-car] img').count(),12);
 await page.screenshot({path:`${output}/garage.png`});
 console.log('Garage verified',names);
 // Render the five real meshes larger for inspection of shapes and paint.
 await page.evaluate(async()=>{
   const THREE=await import('/node_modules/three/build/three.module.js');
   const {VEHICLES,createVehicle}=await import('/src/vehicles.js');
   const {disposeVehicle}=await import('/src/resources.js');
   const gallery=document.createElement('div');gallery.id='qa-gallery';
   gallery.style.cssText='position:fixed;inset:0;z-index:1000;background:#e4e4d6;display:grid;grid-template-columns:repeat(3,1fr);align-content:center;gap:16px;padding:25px;color:#26352b;font:22px Georgia';
   const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(560,360);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
   for(let i=7;i<12;i++){
     const scene=new THREE.Scene();scene.background=new THREE.Color(0xd4d9c9);
     scene.add(new THREE.HemisphereLight(0xffffff,0x89785f,3));
     const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-3,7,-5);scene.add(sun);
     const car=createVehicle(THREE,i);scene.add(car);
     const camera=new THREE.PerspectiveCamera(40,560/360,.1,100);camera.position.set(4,3,-5);camera.lookAt(0,.75,-.4);
     renderer.render(scene,camera);
     const card=document.createElement('div'), img=document.createElement('img');img.src=renderer.domElement.toDataURL();img.style.width='100%';
     const label=document.createElement('div');label.textContent=VEHICLES[i].name;card.append(img,label);gallery.append(card);disposeVehicle(car);
   }
   renderer.dispose();document.body.append(gallery);
 });
 await page.screenshot({path:`${output}/five-new-cars.png`});
 await page.evaluate(()=>document.querySelector('#qa-gallery').remove());
 await page.setViewportSize({width:844,height:390});
 result.cockpits=[];
 for(let i=7;i<12;i++){
   await page.locator(`[data-car="${i}"]`).click();
   await page.evaluate(()=>window.__derby.start(true));
   await page.waitForFunction(()=>window.__derby.racers.length===10);
   assert.equal(await page.locator('#race-rank').innerText().then(t=>t.split('/')[1]),'10');
   await page.evaluate(()=>window.__derby.renderEnabled=true);
   await page.waitForTimeout(120);
   await page.screenshot({path:`${output}/cockpit-${i}.png`});
   await page.evaluate(()=>window.__derby.renderEnabled=false);
   await page.locator('#dashboard-light').click();
   await page.waitForFunction(()=>document.querySelector('#dashboard-light').getAttribute('aria-pressed')==='true');
   await page.locator('#dashboard-light').click();
   result.cockpits.push({index:i,name:names[i],cars:10,headlight:true});
   await page.locator('#pause').click();
 }
 console.log('All five cockpits verified');
 await context.route('**/qa-network',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Network check</title>'}));
 const host=await context.newPage(),guest=await context.newPage();
 for(const p of [host,guest]){
   p.on('pageerror',e=>result.errors.push(e.message));await p.goto(base+'/qa-network');
   await p.evaluate(async()=>{const {FamilyNetwork}=await import('/src/network.js');window.net=new FamilyNetwork();window.messages={};net.onSnapshot=data=>messages.snapshot=data;net.onRoster=data=>messages.roster=data;net.onResults=data=>messages.results=data;net.onVehicle=data=>messages.vehicle=data;});
 }
 const offer=await host.evaluate(()=>net.hostOffer());
 const answer=await guest.evaluate(code=>net.joinOffer(code),offer);
 await host.evaluate(code=>net.acceptAnswer(code),answer);
 await host.waitForFunction(()=>net.connectedCount===1);
 await guest.waitForFunction(()=>net.connectedCount===1);
 await guest.evaluate(()=>net.sendVehicle(11));
 await host.waitForFunction(()=>messages.vehicle===11);
 await host.evaluate(()=>{net.broadcast([88,...Array.from({length:10},(_,i)=>[i*5,0,10,0]).flat()]);net.broadcastRoster([0,11,2,3,4,5,6,7,8,9]);net.broadcastResults([100,101,102,103,104,105,106,107,108,109]);});
 await guest.waitForFunction(()=>messages.snapshot?.length===41 && messages.roster?.length===10 && messages.results?.length===10);
 result.network=await guest.evaluate(()=>({snapshotFloats:messages.snapshot.length,roster:messages.roster,results:messages.results.length}));
 for(const p of [host,guest])await p.evaluate(()=>net.close());
 assert.deepEqual(result.errors,[]);
 await writeFile(`${output}/results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();clearTimeout(hardStop);}
