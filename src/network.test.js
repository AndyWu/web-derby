import test from 'node:test';
import assert from 'node:assert/strict';
import { FamilyNetwork } from './network.js';
import { VEHICLES } from './vehicles.js';
import { RACE_SIZE } from './race-config.js';

test('family channel carries signed swipe direction and touch drive state', () => {
  const host = new FamilyNetwork();
  host.role = 'host';
  const received=[];
  host.onInput=data=>received.push(data);
  const peer={id:'test',pc:{}};
  const channel={};
  host._channel(peer,channel);
  for(const direction of [-1,0,1]) channel.onmessage({data:new Float32Array([0.2,0,0,0,1,0,direction,1]).buffer});
  assert.equal(received.length,3);
  assert.deepEqual(received.map(data=>data[6]),[-1,0,1]);
  channel.onmessage({data:new Float32Array([0,0,0,0,1,0,2,1]).buffer});
  channel.onmessage({data:new Float32Array([0,0,0,0,1,0,1,2]).buffer});
  assert.equal(received.length,3);
  channel.onmessage({data:new Float32Array([0,0,0,0,1,0]).buffer});
  assert.equal(received.length,4);
});


test('family channel validates and preserves swipe strength', () => {
  const host=new FamilyNetwork();host.role='host';
  const received=[];host.onInput=data=>received.push(data);
  const channel={};host._channel({id:'test',pc:{}},channel);
  for(const strength of [0,0.5,1])channel.onmessage({data:new Float32Array([0,0,0,0,0,0,1,1,strength]).buffer});
  assert.deepEqual(received.map(data=>data[8]),[0,0.5,1]);
  for(const strength of [-0.1,1.1])channel.onmessage({data:new Float32Array([0,0,0,0,0,0,1,1,strength]).buffer});
  assert.equal(received.length,3);
});


test('ten-car snapshots, rosters and results reach guests without truncation', () => {
  const host=new FamilyNetwork(), guest=new FamilyNetwork();
  host.role='host';guest.role='guest';
  const incoming={};guest._channel({id:'host',pc:{}},incoming);
  const outgoing={readyState:'open',bufferedAmount:0,send:data=>incoming.onmessage({data:data instanceof Float32Array?data.buffer:data})};
  host.peers.set('guest',{channel:outgoing});
  let snapshot,roster,results;
  guest.onSnapshot=data=>snapshot=data;
  guest.onRoster=data=>roster=data;
  guest.onResults=data=>results=data;
  const world=[88,...Array.from({length:RACE_SIZE},(_,i)=>[i*5,i%3,10+i,0]).flat()];
  host.broadcast(world);
  assert.deepEqual(snapshot,world);
  const choices=Array.from({length:RACE_SIZE},(_,i)=>(i+2)%VEHICLES.length);
  host.broadcastRoster(choices);
  assert.deepEqual(roster,choices);
  const times=Array.from({length:RACE_SIZE},(_,i)=>i?100+i:-1);
  host.broadcastResults(times);
  assert.deepEqual(results,times);
  assert.throws(()=>host.broadcast([88,...world.slice(1,-4)]));
  assert.throws(()=>host.broadcastRoster([...choices,0]));
});

test('host accepts the final garage model and rejects out-of-range choices', () => {
  const host=new FamilyNetwork();host.role='host';
  const channel={};host._channel({id:'guest',pc:{}},channel);
  const accepted=[];host.onVehicle=index=>accepted.push(index);
  channel.onmessage({data:JSON.stringify([66,VEHICLES.length-1])});
  channel.onmessage({data:JSON.stringify([66,VEHICLES.length])});
  assert.deepEqual(accepted,[VEHICLES.length-1]);
});
