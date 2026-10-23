import test from 'node:test';
import assert from 'node:assert/strict';
import {stackLayout,imageDimensions,cleanTitle,landingPose,entranceFrames,settledTransform} from '../dist/stack.js';

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
    assert.ok(layout.side<=Math.min(w,h)*.5+1e-6);
  }
});
test('reference area is a square with half the shorter viewport dimension',()=>{
  const layout=stackLayout(1722,1088,[.527,1,1.5,3.612]);
  assert.equal(layout.area,544**2);
});
test('entrance begins level at top center, remains opaque, and lands at its final pose',()=>{
  const pose=landingPose(12,1,544),frames=entranceFrames(pose,544,330);
  assert.equal(frames.length,41);
  assert.ok(frames.every(f=>f.opacity===1));
  assert.equal(frames[0].offset,0);assert.equal(frames.at(-1).offset,1);
  assert.equal(frames.at(-1).transform,settledTransform(pose));
  assert.equal(frames[0].transform,'translate(-50%, -50%) translate(0px, -107px) rotate(0deg)');
  assert.ok(frames[20].transform!==frames[0].transform);
});
test('successive cards have small alternating final rotations',()=>{
  const a=landingPose(12,0,544),b=landingPose(13,1,544);
  assert.ok(a.angle>0&&a.angle<=3);assert.ok(b.angle<0&&b.angle>=-3);
  assert.deepEqual(a,landingPose(12,0,544));
});
