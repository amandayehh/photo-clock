import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackScroll} from '../dist/back-scroll.js';

function setup({height=300,viewport=100,reduced=false}={}){
  const content={scrollTop:0,scrollHeight:height,clientHeight:viewport};
  let callback=null;
  const controller=createBackScroll(content,{
    reducedMotion:()=>reduced,fontSize:()=>20,
    schedule:fn=>{callback=fn;return 1;},cancel:()=>{callback=null;}
  });
  return {content,controller,pending:()=>callback!==null,step:time=>{const fn=callback;callback=null;fn?.(time);}};
}
test('overflow waits for reading, scrolls through the full back and holds at the end',()=>{
  const h=setup();h.controller.setActive(true);h.step(0);h.step(1300);
  assert.equal(h.content.scrollTop,0);
  for(let now=1400;now<15000;now+=100)h.step(now);
  assert.equal(h.content.scrollTop,200);assert.equal(h.pending(),false);
});
test('releasing stops scrolling and the next flip starts at the beginning',()=>{
  const h=setup();h.controller.setActive(true);
  for(let now=0;now<=2000;now+=100)h.step(now);
  assert.ok(h.content.scrollTop>0);
  h.controller.setActive(false);
  assert.equal(h.content.scrollTop,0);assert.equal(h.pending(),false);
  h.controller.setActive(true);h.step(5000);h.step(6000);
  assert.equal(h.content.scrollTop,0);assert.equal(h.pending(),true);
});
test('content that fits and reduced motion do not animate',()=>{
  for(const options of [{height:100},{reduced:true}]){
    const h=setup(options);h.controller.setActive(true);h.step(0);
    assert.equal(h.content.scrollTop,0);assert.equal(h.pending(),false);
  }
});
