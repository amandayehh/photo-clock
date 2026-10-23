import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {smoothPath,smoothSurface,cornerSmoothing} from '../dist/smoothing.js';
import {stackLayout,imageDimensions} from '../dist/stack.js';

test('smoothed card and image shapes remain valid across aspect ratios and viewports',()=>{
  assert.equal(cornerSmoothing,.6);
  for(const [width,height] of [[1722,1088],[390,844],[844,390]]){
    const layout=stackLayout(width,height,[.527,1,1.5,3.612]);
    for(const ratio of [.527,1,1.5,3.612]){
      const image=imageDimensions(layout.area,ratio);
      for(const [w,h,r] of [[image.width,image.height,layout.radius/2],[image.width+2*layout.pad,image.height+2*layout.pad+2*layout.gap+layout.titleSize*1.15+layout.stampSize*1.15,layout.radius]]){
        const path=smoothPath(w,h,r);
        assert.match(path,/^M /);assert.match(path,/ Z$/);
        assert.equal((path.match(/ a /g)||[]).length,4);
        assert.equal((path.match(/ c /g)||[]).length,8);
        assert.doesNotMatch(path,/NaN|Infinity|undefined/);
        const svg=decodeURIComponent(smoothSurface(w,h,r));
        assert.ok(svg.includes(`viewBox="0 0 ${w} ${h}"`));
        assert.ok(svg.includes(`d="${path}"`));
      }
    }
  }
});
test('the deployed path generator matches the pinned dependency',()=>{
  assert.deepEqual(readFileSync(new URL('../dist/vendor/figma-squircle.js',import.meta.url)),readFileSync(new URL('../node_modules/figma-squircle/dist/index.js',import.meta.url)));
});
