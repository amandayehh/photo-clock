import test from 'node:test';
import assert from 'node:assert/strict';
import {createCardCollection} from '../dist/card-collection.js';

function setup(){
  const live=new Set(),disposed=[];
  let peak=0;
  const collection=createCardCollection({
    mount:(photo,sequence,image)=>{const entry={photo,sequence,image};live.add(entry);peak=Math.max(peak,live.size);return entry;},
    unmount:entry=>{assert.ok(live.delete(entry));disposed.push(entry.sequence);}
  });
  return {collection,live,disposed,peak:()=>peak};
}
test('a full day of arrivals never mounts more than ten stack cards',()=>{
  const h=setup();let entries=[];
  for(let sequence=0;sequence<1440;sequence++){
    entries=h.collection.add({pageid:sequence},{loaded:true});
    assert.equal(entries.length,Math.min(sequence+1,10));
    assert.equal(h.live.size,entries.length);
    assert.equal(entries.at(-1).sequence,sequence);
  }
  assert.equal(h.peak(),10);
  assert.deepEqual(entries.map(e=>e.sequence),Array.from({length:10},(_,i)=>1430+i));
  assert.equal(h.disposed.length,1430);
});
test('Grid restores the complete history in order and returning to Stack releases older cards',()=>{
  const h=setup();let stack;
  for(let i=0;i<25;i++)stack=h.collection.add({pageid:i},{loaded:true});
  const grid=h.collection.setGrid(true);
  assert.equal(grid.length,25);assert.equal(h.live.size,25);
  assert.deepEqual(grid.map(e=>e.photo.pageid),Array.from({length:25},(_,i)=>i));
  assert.deepEqual(grid.slice(-10),stack);
  // Restored cards use their archived photo data, not retained image objects.
  assert.ok(grid.slice(0,15).every(e=>e.image===undefined));
  const withNew=h.collection.add({pageid:25});
  assert.equal(withNew.length,26);
  const restoredStack=h.collection.setGrid(false);
  assert.equal(h.live.size,10);
  assert.deepEqual(restoredStack,withNew.slice(-10));
  assert.equal(h.collection.setGrid(true).length,26);
});
test('midnight clears rendered cards and archived history while preserving the selected view',()=>{
  for(const grid of [false,true]){
    const h=setup();h.collection.setGrid(grid);
    for(let i=0;i<15;i++)h.collection.add({pageid:i});
    h.collection.clear();assert.equal(h.live.size,0);
    const first=h.collection.add({pageid:100});
    assert.equal(first.length,1);assert.equal(first[0].sequence,0);
    for(let i=1;i<12;i++)h.collection.add({pageid:100+i});
    assert.equal(h.live.size,grid?12:10);
    assert.equal(h.collection.setGrid(true).length,12);
  }
});
