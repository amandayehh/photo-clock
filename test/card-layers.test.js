import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCardLayers,stackLayer} from '../dist/card-layers.js';

test('arrival layers remain unchanged through Grid, Stack trimming and DOM reordering',()=>{
  const entries=Array.from({length:24},(_,sequence)=>({sequence,flipped:false,element:{style:{}}}));
  applyCardLayers(entries);
  const original=entries.map(entry=>entry.element.style.zIndex);
  const stack=entries.slice(-8);
  applyCardLayers(stack);
  assert.deepEqual(stack.map(entry=>entry.element.style.zIndex),original.slice(-8));
  applyCardLayers([...entries].reverse());
  assert.deepEqual(entries.map(entry=>entry.element.style.zIndex),original);
  for(const entry of entries.slice(0,-8))assert.ok(stackLayer(entry)<Number(stack[0].element.style.zIndex));
  entries[2].flipped=true;applyCardLayers(entries);
  assert.equal(entries[2].element.style.zIndex,'25');
  entries[2].flipped=false;applyCardLayers(entries);
  assert.deepEqual(entries.map(entry=>entry.element.style.zIndex),original);
});
