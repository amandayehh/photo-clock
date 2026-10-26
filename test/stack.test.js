import test from 'node:test';
import assert from 'node:assert/strict';
import {stackLayout,imageDimensions,cleanTitle,landingPose,entranceFrames,entranceTiming,settledTransform} from '../dist/stack.js';

test('titles omit file prefix, extension, and nested parenthetical text',()=>{
  assert.equal(cleanTitle('File:Midtown (Manhattan) (NYC (2024)).jpg'),'Midtown');
  assert.equal(cleanTitle('File:Central_Park (123456) at dusk.JPG'),'Central Park at dusk');
  assert.equal(cleanTitle('File:Meadows.jpg'),'Meadows');
});
test('landscape, portrait and square photos have identical surface area',()=>{
  for(const [w,h] of [[861,544],[1722,1088],[390,844],[844,390]]){
    const layout=stackLayout(w,h,[.527,1,1.5,3.612]);
    for(const ratio of [.527,1,1.5,3.612]){
      const d=imageDimensions(layout.area,ratio);
      assert.ok(Math.abs(d.width*d.height-layout.area)<1e-6);
      assert.ok(Math.abs(d.width/d.height-ratio)<1e-10);
    }
    assert.ok(layout.side<=Math.min(w,h)*.56+1e-6);
    for(const ratio of [.527,1,1.5,3.612]){
      const size=imageDimensions(layout.area,ratio),theta=3*Math.PI/180;
      const cardWidth=size.width+2*layout.pad;
      const cardHeight=size.height+2*layout.pad+2*layout.gap+1.15*(layout.titleSize+layout.stampSize);
      assert.ok(cardWidth*Math.cos(theta)+cardHeight*Math.sin(theta)<=w*.96+1e-6);
      assert.ok(cardHeight*Math.cos(theta)+cardWidth*Math.sin(theta)<=h*.84+1e-6);
    }
  }
});
test('reference area is a square with half the shorter viewport dimension',()=>{
  const layout=stackLayout(1722,1088,[1,1.5]);
  assert.equal(layout.area,544**2);
});
test('entrance begins fully above the viewport, remains opaque, and lands at its final pose',()=>{
  const pose=landingPose(12,1,544),frames=entranceFrames(pose,544,330);
  assert.equal(frames.length,2);
  assert.ok(frames.every(f=>f.opacity===1));
  assert.equal(frames[0].offset,0);assert.equal(frames.at(-1).offset,1);
  assert.equal(frames.at(-1).transform,settledTransform(pose));
  assert.equal(frames[0].transform,'translate(-50%, -50%) translate(0px, -517px) rotate(0deg)');
  assert.ok(frames[1].transform!==frames[0].transform);
});
test('successive cards have small alternating final rotations',()=>{
  const a=landingPose(12,0,544),b=landingPose(13,1,544);
  assert.ok(a.angle>0&&a.angle<=3);assert.ok(b.angle<0&&b.angle>=-3);
  assert.deepEqual(a,landingPose(12,0,544));
});

test('original easing plays immediately for exactly one second',()=>{
  assert.equal(entranceTiming.delay,0);
  assert.equal(entranceTiming.duration,1000);
  assert.equal(entranceTiming.easing,'cubic-bezier(0.22, 0.65, 0.28, 1)');
  assert.equal(entranceTiming.fill,'backwards');
});

test('the entire card and shadow begin outside the viewport for every card height',()=>{
  for(const [viewportHeight,cardHeight] of [[1088,650],[844,450],[390,220]]){
    const first=entranceFrames({x:5,y:0,angle:2},viewportHeight,cardHeight)[0];
    const y=Number(first.transform.match(/translate\(0px, ([^p]+)px\)/)[1]);
    const bottom=viewportHeight/2+y+cardHeight/2;
    assert.equal(bottom,-80);
    assert.ok(first.transform.endsWith('rotate(0deg)'));
    assert.equal(entranceTiming.fill,'backwards');
  }
});

test('entrance follows a straight path from its offscreen start to the landing point',()=>{
  const pose={x:12,y:4,angle:2},startY=-(800+400)/2-80;
  for(const frame of entranceFrames(pose,800,400)){
    const match=frame.transform.match(/translate\((-?[\d.e+]+)px, (-?[\d.e+]+)px\)/);
    const x=Number(match[1]),y=Number(match[2]);
    assert.ok(Math.abs(x*(pose.y-startY)-(y-startY)*pose.x)<1e-6);
  }
});
