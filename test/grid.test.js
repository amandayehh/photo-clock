import test from 'node:test';
import assert from 'node:assert/strict';
import {gridColumns,gridLayout,gridImageDimensions,cardTransform} from '../dist/grid.js';
import {settledTransform} from '../dist/stack.js';

test('grid uses every column count from three to eight as available width increases',()=>{
  for(const [width,columns] of [[320,3],[390,3],[629,3],[630,4],[768,4],[820,5],[1024,6],[1200,7],[1350,8],[1440,8],[2560,8]]){
    assert.equal(gridColumns(width),columns);
  }
});
test('ordinary grid photos share an area while fitting column width and available height',()=>{
  for(const cell of [60,76,120,180,300]){
    for(const height of [130,600]){
      const layout=gridLayout(cell,height);
      for(const ratio of [.5,.527,1,1.5,2]){
        const size=gridImageDimensions(layout,ratio);
        assert.ok(size.width+layout.pad*2<=cell+1e-8);
        assert.ok(size.height+2*layout.pad+2*layout.gap+1.15*(layout.titleSize+layout.stampSize)<=height+1e-8);
        assert.ok(Math.abs(size.width/size.height-ratio)<1e-8);
        assert.ok(Math.abs(size.width*size.height-layout.area)<1e-8);
      }
    }
  }
});
test('grid outliers fit individually without shrinking ordinary photos',()=>{
  const layout=gridLayout(150,400),area=layout.area;
  for(const ratio of [.1,.3,3.612,7,20]){
    const size=gridImageDimensions(layout,ratio);
    assert.ok(size.width<=layout.imageWidth+1e-8);
    assert.ok(size.height<=layout.imageHeight+1e-8);
    assert.ok(size.width*size.height<=area+1e-8);
    assert.ok(Math.abs(size.width/size.height-ratio)<1e-8);
    assert.equal(layout.area,area);
  }
  const square=gridImageDimensions(layout,1);
  assert.equal(square.width*square.height,area);
});
test('grid cards return to their own cell; stacked cards retain their original positioning',()=>{
  assert.equal(cardTransform({x:0,y:0,angle:0},true),'translate(0px, 0px) rotate(0deg)');
  const dragged={x:120,y:-40,angle:0};
  assert.equal(cardTransform(dragged,true),'translate(120px, -40px) rotate(0deg)');
  const stacked={x:5,y:3,angle:2.2};
  assert.equal(cardTransform(stacked,false),settledTransform(stacked));
});
