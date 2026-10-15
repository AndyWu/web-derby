import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VEHICLES, createVehicle } from './vehicles.js';
import { disposeVehicle } from './resources.js';

test('twelve-car catalog removes the requested cars and builds every playable model', () => {
  assert.equal(VEHICLES.length,12);
  const names=VEHICLES.map(v=>v.name);
  assert.equal(new Set(names).size,12);
  for(const name of ['Thunder Pumpkin','Rustbucket','Blackberry Jam'])assert.ok(!names.includes(name));
  for(const name of ['Firefly','Miss Georgia','Silver Claw','Tiger Stripe','Shuttlecraft'])assert.ok(names.includes(name));
  for(let i=0;i<VEHICLES.length;i++){
    const car=createVehicle(THREE,i,true);
    assert.equal(car.name,VEHICLES[i].name);
    for(const key of ['wheel','brake','gear','headlight','flag'])assert.ok(car.userData[key],`${car.name}: ${key}`);
    assert.equal(car.userData.paddles.length,2);
    assert.ok(car.userData.flag.userData.cloth);
    const bounds=new THREE.Box3().setFromObject(car);
    assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),`${car.name} finite geometry`);
    assert.ok(bounds.max.z-bounds.min.z>2);
    for(const key of ['mass','drag','grip','handling','topSpeed','paddleForce'])assert.ok(Number.isFinite(VEHICLES[i][key]));
    disposeVehicle(car);
  }
});
