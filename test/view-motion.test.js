import test from 'node:test';
import assert from 'node:assert/strict';
import {viewFrames,viewTiming,captureCards,createViewMotion} from '../dist/view-motion.js';
import {createCardCollection} from '../dist/card-collection.js';

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

test('restored cards start at their measured stack geometry while live snapshots are preserved',t=>{
  const saved={getComputedStyle:globalThis.getComputedStyle,DOMMatrixReadOnly:globalThis.DOMMatrixReadOnly};
  t.after(()=>{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  globalThis.getComputedStyle=card=>card.computed;
  globalThis.DOMMatrixReadOnly=class{
    constructor(angle){const radians=Number(angle)*Math.PI/180;this.a=this.d=Math.cos(radians);this.b=Math.sin(radians);this.c=-this.b;}
  };
  const live={element:{getBoundingClientRect(){throw new Error('Live animation must not be remeasured');}}};
  const liveSnapshot={x:400,y:150,width:200,height:300,angle:1};
  const before=new Map([[live,liveSnapshot]]);
  // Landscape, portrait and extreme cards share the stack center but retain their own dimensions.
  const restored=[[600,400,2],[400,600,-2],[800,150,1.5]].map(([width,height,angle])=>({element:{
    computed:{width:String(width),height:String(height),transform:String(angle)},
    getBoundingClientRect(){return {left:500-width/2,top:350-height/2,width,height};}
  }}));
  assert.equal(captureCards([...restored,live],before),before);
  assert.equal(before.get(live),liveSnapshot);
  assert.equal(before.size,4);
  restored.forEach((entry,index)=>{
    const from=before.get(entry),to={x:80+index*160,y:100,width:120,height:100,angle:0};
    assert.equal(from.x,500);assert.equal(from.y,350);
    assert.ok(Math.abs(from.width-Number(entry.element.computed.width))<1e-8);
    assert.ok(Math.abs(from.height-Number(entry.element.computed.height))<1e-8);
    assert.ok(Math.abs(from.angle-Number(entry.element.computed.transform))<1e-8);
    const [first,last]=viewFrames(from,to);
    assert.ok(first.transform.includes(`translate(${500-to.x}px, 250px)`));
    assert.ok(last.transform.includes('translate(0px, 0px)'));
  });
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
  let completions=0;
  const motion=createViewMotion();motion.play([entry],before,()=>{completions++;assert.equal(card.parent,slot);});
  assert.equal(body.children.length,1);
  assert.equal(body.children[0].inert,true);
  assert.equal(slot.children.length,0);
  assert.equal(slot.style.height,'120px');
  motion.finish();
  motion.finish();assert.equal(completions,1);
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

  // All Grid cards participate in collapse; only after landing are older cards released.
  const resolvers=[],live=new Set();
  const collection=createCardCollection({
    mount(photo,sequence){
      const element=new Node(),slot=new Node();slot.append(element);
      element.animate=()=>({cancel(){},finished:new Promise(resolve=>resolvers.push(resolve))});
      const entry={photo,sequence,element,slot};live.add(entry);return entry;
    },
    unmount(entry){assert.equal(entry.element.parent,entry.slot);entry.slot.remove();live.delete(entry);}
  });
  collection.setGrid(true);
  let grid;
  for(let i=0;i<12;i++)grid=collection.add({pageid:i});
  let retained;
  motion.play(grid,captureCards(grid),()=>{retained=collection.setGrid(false);});
  assert.equal(body.children[0].children.length,12);
  assert.equal(live.size,12);
  assert.equal(retained,undefined);
  for(const resolve of resolvers)resolve();
  await Promise.resolve();await Promise.resolve();
  assert.equal(body.children.length,0);
  assert.equal(live.size,5);
  assert.deepEqual(retained.map(entry=>entry.sequence),[7,8,9,10,11]);
});
