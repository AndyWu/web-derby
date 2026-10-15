import test from 'node:test';
import assert from 'node:assert/strict';
import { FamilyNetwork } from './network.js';

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
