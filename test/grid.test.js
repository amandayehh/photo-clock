import test from 'node:test';
import assert from 'node:assert/strict';
import {gridColumns,gridCardLayout,cardTransform} from '../dist/grid.js';
import {settledTransform} from '../dist/stack.js';

test('grid switches between four, six and eight columns at responsive breakpoints',()=>{
  for(const [width,columns] of [[320,4],[390,4],[767,4],[768,6],[820,6],[1023,6],[1024,8],[1440,8],[2560,8]]){
    assert.equal(gridColumns(width),columns);
  }
});
test('grid cards fit their column and preserve portrait, square and landscape proportions',()=>{
  for(const cell of [60,76,120,180,300])for(const ratio of [.527,1,1.5,3.612]){
    const layout=gridCardLayout(cell,ratio);
    assert.ok(Math.abs(layout.width+layout.pad*2-cell)<1e-8);
    assert.ok(Math.abs(layout.width/layout.height-ratio)<1e-8);
    assert.ok(layout.height>0&&layout.radius>0);
  }
});
test('grid cards return to their own cell; stacked cards retain their original positioning',()=>{
  assert.equal(cardTransform({x:0,y:0,angle:0},true),'translate(0px, 0px) rotate(0deg)');
  const dragged={x:120,y:-40,angle:0};
  assert.equal(cardTransform(dragged,true),'translate(120px, -40px) rotate(0deg)');
  const stacked={x:5,y:3,angle:2.2};
  assert.equal(cardTransform(stacked,false),settledTransform(stacked));
});
