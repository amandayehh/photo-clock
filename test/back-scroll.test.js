import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackScroll} from '../dist/back-scroll.js';

function setup({height=300,viewport=100,reduced=false}={}){
  const content=Object.assign(new EventTarget(),{scrollTop:0,scrollHeight:height,clientHeight:viewport});
  let callback=null,edges=null;
  const controller=createBackScroll(content,{
    reducedMotion:()=>reduced,fontSize:()=>20,
    onEdges:value=>{edges=value;},
    schedule:fn=>{callback=fn;return 1;},cancel:()=>{callback=null;}
  });
  return {content,controller,edges:()=>edges,pending:()=>callback!==null,step:time=>{const fn=callback;callback=null;fn?.(time);}};
}
test('overflow waits for reading, scrolls through the full back and holds at the end',()=>{
  const h=setup();h.controller.setActive(true);h.step(0);h.step(1300);
  assert.equal(h.content.scrollTop,0);
  for(let now=1400;now<15000;now+=100)h.step(now);
  assert.equal(h.content.scrollTop,200);assert.equal(h.pending(),false);
  assert.deepEqual(h.edges(),{top:true,bottom:false});
});
test('fades indicate only clipped edges during manual scrolling, resizing and repeat flips',()=>{
  const h=setup({reduced:true});
  h.controller.setActive(true);
  assert.deepEqual(h.edges(),{top:false,bottom:true});
  h.content.scrollTop=80;h.content.dispatchEvent(new Event('scroll'));
  assert.deepEqual(h.edges(),{top:true,bottom:true});
  h.content.scrollTop=199.5;h.content.dispatchEvent(new Event('scroll'));
  assert.deepEqual(h.edges(),{top:true,bottom:false});
  h.controller.setActive(false);h.controller.setActive(true);
  assert.deepEqual(h.edges(),{top:false,bottom:true});
  h.content.clientHeight=400;h.controller.refresh();
  assert.deepEqual(h.edges(),{top:false,bottom:false});
  h.content.clientHeight=60;h.controller.refresh();
  assert.deepEqual(h.edges(),{top:false,bottom:true});
});
test('backs that fit show neither fade',()=>{
  const h=setup({height:80,viewport:100});h.controller.setActive(true);
  assert.deepEqual(h.edges(),{top:false,bottom:false});
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

for(const font of [3,16])test(`rounded scrolling reaches the end at ${font}px metadata size`,()=>{
  let stored=0,callback=null;
  const content={scrollHeight:130,clientHeight:100,get scrollTop(){return stored;},set scrollTop(value){stored=Math.floor(value);}};
  const controller=createBackScroll(content,{fontSize:()=>font,schedule:fn=>{callback=fn;return 1;},cancel:()=>{callback=null;}});
  controller.setActive(true);
  // Small grid fonts and high refresh rates must still accumulate movement.
  for(let now=0;now<15000&&callback;now+=1000/120){const fn=callback;callback=null;fn(now);}
  assert.equal(content.scrollTop,30);
  assert.equal(callback,null);
});
