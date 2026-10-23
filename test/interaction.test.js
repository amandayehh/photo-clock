import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCardInteraction,releaseHeldCard} from '../dist/interaction.js';

class Card extends EventTarget{
  captured=new Set();
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
  focus(){}
  send(type,props={}){const event=new Event(type,{cancelable:true});Object.assign(event,props);this.dispatchEvent(event);return event;}
}
function setup(){
  const card=new Card(),state={held:false,x:0,y:0,lifts:0,details:0};
  bindCardInteraction(card,{onLift:()=>state.lifts++,onMove:(x,y)=>{state.x+=x;state.y+=y;},onFlip:held=>state.held=held,onDetails:()=>state.details++});
  return {card,state};
}
const down={button:0,isPrimary:true,pointerId:1,clientX:100,clientY:100};
test('drag starts immediately and cancels the delayed flip',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {card,state}=setup();
  assert.equal(card.send('pointerdown',down).defaultPrevented,true);
  assert.equal(state.held,false);assert.ok(card.hasPointerCapture(1));
  card.send('pointermove',{pointerId:1,clientX:170,clientY:200});
  t.mock.timers.tick(1500);assert.equal(state.held,false);assert.equal(state.x,70);
  card.send('pointerup',{pointerId:1,clientX:180,clientY:210});
  assert.deepEqual([state.x,state.y,state.held],[80,110,false]);
  assert.equal(card.hasPointerCapture(1),false);
  card.send('click',{detail:1});assert.equal(state.details,0);
});
test('cancellation, lost capture and window cleanup cancel pending flips',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  for(const type of ['pointercancel','lostpointercapture','window-blur']){
    const {card,state}=setup();card.send('pointerdown',down);
    if(type==='window-blur')releaseHeldCard();else card.send(type,{pointerId:1});
    t.mock.timers.tick(1500);
    assert.equal(state.held,false);assert.equal(card.hasPointerCapture(1),false);
  }
});
test('only the active pointer moves a card, and picking another card releases it',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const a=setup(),b=setup();a.card.send('pointerdown',down);
  a.card.send('pointermove',{pointerId:2,clientX:500,clientY:500});
  assert.equal(a.state.x,0);
  b.card.send('pointerdown',down);
  t.mock.timers.tick(1000);
  assert.equal(a.state.held,false);assert.equal(b.state.held,true);
  releaseHeldCard();
});
test('keyboard users can hold to flip, move, release, and access full credits',()=>{
  const {card,state}=setup();card.send('keydown',{code:'Space',key:' '});
  assert.equal(state.held,true);
  card.send('keydown',{key:'ArrowRight',shiftKey:true});assert.equal(state.x,30);
  card.send('keyup',{code:'Space'});assert.equal(state.held,false);
  card.send('click',{detail:0});assert.equal(state.details,1);
});

test('holding still flips at exactly 0.6 seconds and release flips back',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {card,state}=setup();card.send('pointerdown',down);
  t.mock.timers.tick(599);assert.equal(state.held,false);
  t.mock.timers.tick(1);assert.equal(state.held,true);
  card.send('pointerup',down);assert.equal(state.held,false);
});
test('a quick click never flips later',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {card,state}=setup();card.send('pointerdown',down);
  t.mock.timers.tick(100);card.send('pointerup',down);
  t.mock.timers.tick(1000);assert.equal(state.held,false);
});
