import test from 'node:test';
import assert from 'node:assert/strict';
import {viewFrames,viewTiming,captureCards,createViewMotion} from '../dist/view-motion.js';

test('layout motion preserves the starting center, size and rotation in either direction',()=>{
  const stack={x:800,y:450,width:600,height:440,angle:2.5};
  const grid={x:100,y:180,width:120,height:100,angle:0};
  for(const [from,to] of [[stack,grid],[grid,stack],[{...grid,y:-400},stack]]){
    const [first,last]=viewFrames(from,to);
    const match=first.transform.match(/translate\((-?[\d.e+]+)px, (-?[\d.e+]+)px\) rotate\((-?[\d.e+]+)deg\) scale\(([\d.e+]+), ([\d.e+]+)\)/);
    assert.ok(match);
    assert.equal(to.x+Number(match[1]),from.x);
    assert.equal(to.y+Number(match[2]),from.y);
    assert.ok(Math.abs(to.width*Number(match[4])-from.width)<1e-8);
    assert.ok(Math.abs(to.height*Number(match[5])-from.height)<1e-8);
    assert.equal(Number(match[3]),from.angle);
    assert.equal(last.transform,`translate(-50%, -50%) translate(0px, 0px) rotate(${to.angle}deg) scale(1, 1)`);
    assert.equal(first.opacity,1);assert.equal(last.opacity,1);
  }
  assert.equal(viewTiming.duration,700);
});

test('interrupted view motion captures the current scaled position and restores cards and slots',async t=>{
  const saved={document:globalThis.document,getComputedStyle:globalThis.getComputedStyle,DOMMatrixReadOnly:globalThis.DOMMatrixReadOnly};
  t.after(()=>{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  class Node{
    style={};children=[];parent=null;
    append(child){if(child.parent)child.remove();this.children.push(child);child.parent=this;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}
    getBoundingClientRect(){return {left:100,top:50,width:240,height:120};}
  }
  const body=new Node(),slot=new Node(),card=new Node();slot.style.height='';slot.append(card);
  Object.assign(card.style,{position:'relative',left:'auto',top:'auto',transform:'translate(0px, 0px)'});
  let resolve;
  card.animate=()=>({cancelled:false,cancel(){this.cancelled=true;},finished:new Promise(r=>{resolve=r;})});
  globalThis.document={body,createElement:()=>new Node()};
  globalThis.getComputedStyle=()=>({width:'120px',height:'60px',transform:'matrix(2,0,0,2,0,0)'});
  globalThis.DOMMatrixReadOnly=class{a=2;b=0;c=0;d=2;};
  const entry={element:card,slot},before=captureCards([entry]);
  assert.deepEqual(before.get(entry),{x:220,y:110,width:240,height:120,angle:0});
  const motion=createViewMotion();motion.play([entry],before);
  assert.equal(body.children.length,1);
  assert.equal(body.children[0].inert,true);
  assert.equal(slot.children.length,0);
  assert.equal(slot.style.height,'120px');
  motion.finish();
  assert.equal(body.children.length,0);
  assert.equal(slot.children[0],card);
  assert.equal(slot.style.height,'');
  assert.equal(card.style.position,'relative');
  assert.equal(card.style.transform,'translate(0px, 0px)');
  // A stale completion must not tear down the next transition.
  const oldResolve=resolve;motion.play([entry],before);oldResolve();await Promise.resolve();await Promise.resolve();
  assert.equal(body.children.length,1);
  resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(body.children.length,0);
  assert.equal(slot.children[0],card);
});
