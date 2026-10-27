import test from 'node:test';
import assert from 'node:assert/strict';
import {createLinkDropTarget} from '../dist/drag-target.js';

const source='https://commons.wikimedia.org/wiki/File:Midtown.jpg';
function setup(portrait=false){
  const classes=new Set(),opened=[];
  const element={
    classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),toggle:(n,on)=>on?classes.add(n):classes.delete(n)},
    getBoundingClientRect:()=>portrait?{left:0,right:400,top:700,bottom:800}:{left:900,right:1000,top:0,bottom:800}
  };
  return {target:createLinkDropTarget(element,url=>opened.push(url),{isPortrait:()=>portrait}),classes,opened};
}
test('drag shows the edge, highlights on approach, and opens once on an inside drop',()=>{
  const {target,classes,opened}=setup();
  target.show({x:500,y:300});assert.ok(classes.has('visible'));assert.ok(!classes.has('over'));
  target.show({x:950,y:300});assert.ok(classes.has('over'));assert.equal(opened.length,0);
  target.show({x:600,y:300});assert.ok(!classes.has('over'));
  target.release(source,{dragging:true,cancelled:false,x:950,y:300});
  assert.deepEqual(opened,[source]);assert.equal(classes.size,0);
});
test('portrait strip highlights from above and opens only on a drop inside the bottom strip',()=>{
  const {target,classes,opened}=setup(true);
  target.show({x:200,y:667});assert.ok(!classes.has('over'));
  target.show({x:200,y:668});assert.ok(classes.has('over'));
  target.release(source,{dragging:true,cancelled:false,x:200,y:680});
  assert.equal(opened.length,0);
  target.show({x:200,y:750});assert.ok(classes.has('over'));
  target.release(source,{dragging:true,cancelled:false,x:200,y:750});
  assert.deepEqual(opened,[source]);assert.equal(classes.size,0);
});
test('approaching the panel brightens it without making outside drops open a link',()=>{
  const {target,classes,opened}=setup();
  target.show({x:867,y:300});assert.ok(!classes.has('over'));
  target.show({x:868,y:300});assert.ok(classes.has('over'));
  target.release(source,{dragging:true,cancelled:false,x:880,y:300});
  assert.equal(opened.length,0);assert.equal(classes.size,0);
});
test('the image edge triggers full opacity even when the cursor is far from the strip',()=>{
  for(const portrait of [false,true]){
    const {target,classes,opened}=setup(portrait);
    const point=portrait?{x:200,y:500}:{x:650,y:300};
    const near=portrait?{left:100,right:300,top:350,bottom:680}:{left:500,right:880,top:200,bottom:400};
    const far=portrait?{...near,bottom:650}:{...near,right:850};
    target.show(point,far);assert.ok(!classes.has('over'));
    target.show(point,near);assert.ok(classes.has('over'));
    target.show(point,far);assert.ok(!classes.has('over'));
    target.release(source,{...point,dragging:true,cancelled:false});
    assert.equal(opened.length,0);assert.equal(classes.size,0);
  }
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
