import test from 'node:test';
import assert from 'node:assert/strict';
import {createCardExit,collapseFadeDelay} from '../dist/card-exit.js';

function card(){
  let resolve,reject;
  const animation={finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),cancel(){reject(new Error('cancelled'));}};
  const entry={sequence:12,slot:{style:{}},element:{animate(frames,timing){this.frames=frames;this.timing=timing;return animation;}}};
  return {entry,resolve,reject};
}

test('outgoing stack cards fade with ease-in for 0.5 seconds before their resources are removed',async()=>{
  const removed=[],exits=createCardExit(entry=>removed.push(entry));
  const {entry,resolve}=card();
  exits.retire(entry,true);
  assert.deepEqual(removed,[]);
  assert.equal(entry.element.timing.duration,500);
  assert.equal(entry.element.timing.easing,'ease-in');
  assert.deepEqual(entry.element.frames,[{opacity:1},{opacity:0}]);
  assert.equal(entry.slot.inert,true);
  // Override the Stack stylesheet's display:contents, which cannot render opacity.
  assert.equal(entry.slot.style.display,'block');
  assert.equal(entry.slot.style.zIndex,'13');
  assert.equal(entry.slot.style.position,'absolute');
  resolve();await Promise.resolve();
  assert.deepEqual(removed,[entry]);
  exits.finish();assert.equal(removed.length,1);
});

test('view changes clean up every pending fade once, including stale completion',async()=>{
  const removed=[],exits=createCardExit(entry=>removed.push(entry));
  const cards=Array.from({length:12},card);
  cards.forEach(({entry})=>exits.retire(entry,true));
  exits.finish();
  assert.equal(removed.length,12);
  cards.forEach(({resolve})=>resolve());
  await Promise.resolve();exits.finish();
  assert.equal(new Set(removed).size,12);
  assert.equal(removed.length,12);
});

test('reduced motion and grid removals release resources immediately',()=>{
  const removed=[],exits=createCardExit(entry=>removed.push(entry));
  const entry={slot:{animate(){throw new Error('Should not animate');}}};
  exits.retire(entry,false);
  assert.deepEqual(removed,[entry]);
});


test('collapse fade starts immediately for the 700ms transition and continues without restarting',async()=>{
  const removed=[],exits=createCardExit(entry=>removed.push(entry));
  const {entry,resolve}=card();
  assert.equal(collapseFadeDelay(700),0);
  assert.equal(collapseFadeDelay(300),0);
  exits.start(entry,collapseFadeDelay(700));
  const timing=entry.element.timing;
  assert.equal(timing.delay,0);
  assert.equal(timing.duration,500);
  exits.retire(entry,true);
  assert.equal(entry.element.timing,timing);
  assert.deepEqual(removed,[]);
  resolve();await Promise.resolve();
  assert.deepEqual(removed,[entry]);
});

test('finishing a fade before retirement does not remove a live collection card',async()=>{
  const removed=[],exits=createCardExit(entry=>removed.push(entry));
  const {entry,resolve}=card();
  exits.start(entry,200);resolve();await Promise.resolve();
  assert.deepEqual(removed,[]);
  exits.retire(entry,true);
  assert.deepEqual(removed,[entry]);
});
