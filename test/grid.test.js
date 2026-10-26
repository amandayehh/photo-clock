import test from 'node:test';
import assert from 'node:assert/strict';
import {gridColumns,gridLayout,cardTransform} from '../dist/grid.js';
import {settledTransform,imageDimensions} from '../dist/stack.js';

test('grid uses every column count from three to eight as available width increases',()=>{
  for(const [width,columns] of [[320,3],[390,3],[629,3],[630,4],[768,4],[820,5],[1024,6],[1200,7],[1350,8],[1440,8],[2560,8]]){
    assert.equal(gridColumns(width),columns);
  }
});
test('grid photos have equal areas, fit their columns and retain their aspect ratios',()=>{
  const ratios=[.527,1,1.5,3.612];
  for(const cell of [60,76,120,180,300]){
    const layout=gridLayout(cell,ratios);
    for(const ratio of ratios){
      const size=imageDimensions(layout.area,ratio);
      assert.ok(size.width+layout.pad*2<=cell+1e-8);
      assert.ok(Math.abs(size.width/size.height-ratio)<1e-8);
      assert.ok(Math.abs(size.width*size.height-layout.area)<1e-8);
      assert.ok(size.height>0&&layout.radius>0);
    }
  }
});
test('grid layout handles empty and portrait-only collections and refits when a panorama arrives',()=>{
  for(const ratios of [[],[.5],[1],[.5,1,5]]){
    const layout=gridLayout(150,ratios);
    assert.ok(Number.isFinite(layout.area)&&layout.area>0);
    for(const ratio of ratios)assert.ok(imageDimensions(layout.area,ratio).width+layout.pad*2<=150+1e-8);
  }
  assert.ok(gridLayout(150,[.5,1,5]).area<gridLayout(150,[.5,1]).area);
});
test('grid cards return to their own cell; stacked cards retain their original positioning',()=>{
  assert.equal(cardTransform({x:0,y:0,angle:0},true),'translate(0px, 0px) rotate(0deg)');
  const dragged={x:120,y:-40,angle:0};
  assert.equal(cardTransform(dragged,true),'translate(120px, -40px) rotate(0deg)');
  const stacked={x:5,y:3,angle:2.2};
  assert.equal(cardTransform(stacked,false),settledTransform(stacked));
});
