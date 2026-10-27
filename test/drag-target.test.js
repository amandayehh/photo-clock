import test from 'node:test';
import assert from 'node:assert/strict';
import {createLinkDropTarget} from '../dist/drag-target.js';

const source='https://commons.wikimedia.org/wiki/File:Midtown.jpg';
function setup(){
  const classes=new Set(),opened=[];
  const element={
    classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),toggle:(n,on)=>on?classes.add(n):classes.delete(n)},
    getBoundingClientRect:()=>({left:900,right:1000,top:0,bottom:800})
  };
  return {target:createLinkDropTarget(element,url=>opened.push(url)),classes,opened};
}
test('drag shows the edge, highlights on approach, and opens once on an inside drop',()=>{
  const {target,classes,opened}=setup();
  target.show({x:500,y:300});assert.ok(classes.has('visible'));assert.ok(!classes.has('over'));
  target.show({x:950,y:300});assert.ok(classes.has('over'));assert.equal(opened.length,0);
  target.show({x:600,y:300});assert.ok(!classes.has('over'));
  target.release(source,{dragging:true,cancelled:false,x:950,y:300});
  assert.deepEqual(opened,[source]);assert.equal(classes.size,0);
});
test('approaching the panel brightens it without making outside drops open a link',()=>{
  const {target,classes,opened}=setup();
  target.show({x:867,y:300});assert.ok(!classes.has('over'));
  target.show({x:868,y:300});assert.ok(classes.has('over'));
  target.release(source,{dragging:true,cancelled:false,x:880,y:300});
  assert.equal(opened.length,0);assert.equal(classes.size,0);
});
test('outside drops, clicks, cancellations and invalid source links never open a tab',()=>{
  const invalid=[
    [source,{x:899}], [source,{x:1001}], [source,{y:-1}], [source,{y:801}],
    [source,{dragging:false}], [source,{cancelled:true}],
    ['javascript:alert(1)',{}],['https://example.com',{}],['',{}]
  ];
  for(const [url,overrides] of invalid){
    const {target,classes,opened}=setup();target.show({x:950,y:300});
    target.release(url,{dragging:true,cancelled:false,x:950,y:300,...overrides});
    assert.equal(opened.length,0);assert.equal(classes.size,0);
  }
});
