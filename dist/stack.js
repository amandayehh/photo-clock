import {hash} from './core.js';
export function cleanTitle(title){
  let value=String(title||'New York').replace(/^File:/i,'').replace(/\.(?:jpe?g|png|webp|tiff?)$/i,'').replaceAll('_',' ');
  // Remove nested parentheticals as well as their enclosing parentheses.
  while(/\([^()]*\)/.test(value))value=value.replace(/\([^()]*\)/g,' ');
  return value.replace(/\s+/g,' ').trim()||'New York';
}
// Bounds describe the stage between the toolbar and clock, inside the shared page padding.
export function stackLayout(width,height,bounds){
  const short=Math.min(width,height),pad=Math.max(7,Math.min(20,short*10/544));
  const titleSize=Math.max(14,Math.min(40,short*20/544));
  const stampSize=Math.max(9,titleSize*.45);
  const clockHeight=Math.max(20,Math.min(40,short*.0368))*1.2;
  const stage=bounds||{width:width-40,height:height-80-35.6-clockHeight};
  const poseScale=Math.min(1.6,short/544);
  // Keep the tilted silhouette and landing offsets inside the stage, with room for its shadow.
  const shadowRoom=16;
  const layout={pad,gap:pad*.75,titleSize,stampSize,radius:pad*.8,
    maxWidth:Math.max(0,stage.width-2*(6*poseScale+shadowRoom)),
    maxHeight:Math.max(0,stage.height-2*(4*poseScale+shadowRoom))};
  // Every ordinary proportion shares the largest area that fits both ends of 1:2–2:1.
  const side=Math.min(fittingSide(layout,.5),fittingSide(layout,2));
  return {...layout,side,area:side*side};
}
export function rotatedCardBounds(layout,side,ratio){
  const w=side*Math.sqrt(ratio)+2*layout.pad;
  const h=side/Math.sqrt(ratio)+2*layout.pad+2*layout.gap+1.15*(layout.titleSize+layout.stampSize);
  const theta=3*Math.PI/180;
  const xAngle=Math.min(theta,Math.atan2(h,w)),yAngle=Math.min(theta,Math.atan2(w,h));
  return {width:w*Math.cos(xAngle)+h*Math.sin(xAngle),height:h*Math.cos(yAngle)+w*Math.sin(yAngle)};
}
function fittingSide(layout,ratio){
  let low=0,high=Math.max(layout.maxWidth,layout.maxHeight);
  for(let n=0;n<40;n++){
    const side=(low+high)/2,bounds=rotatedCardBounds(layout,side,ratio);
    if(bounds.width<=layout.maxWidth&&bounds.height<=layout.maxHeight)low=side;else high=side;
  }
  return low;
}
export function stackImageDimensions(layout,ratio){
  const side=ratio<.5||ratio>2?Math.min(layout.side,fittingSide(layout,ratio)):layout.side;
  return imageDimensions(side*side,ratio);
}
export function imageDimensions(area,ratio){return {width:Math.sqrt(area*ratio),height:Math.sqrt(area/ratio)};}
export function landingPose(id,sequence,short){
  const seed=hash(`${id}|${sequence}`),scale=Math.min(1.6,short/544);
  // Alternate the tilt, giving successive white edges room to show.
  return {x:((seed%13)-6)*scale,y:((Math.floor(seed/13)%9)-4)*scale,angle:(sequence%2===0?1:-1)*(1.4+(seed%15)/10)};
}
// Original easing, with the current one-second duration and no start delay.
export const entranceTiming=Object.freeze({duration:1000,delay:0,easing:'cubic-bezier(0.22, 0.65, 0.28, 1)',fill:'backwards'});
export function entranceFrames(pose,viewportHeight,cardHeight){
  // Interpolate directly from above the window to the final pose, with no spatial curve.
  const start={x:0,y:-(viewportHeight+cardHeight)/2-80,angle:0};
  return [
    {offset:0,transform:settledTransform(start),opacity:1},
    {offset:1,transform:settledTransform(pose),opacity:1}
  ];
}
export function settledTransform(pose){return `translate(-50%, -50%) translate(${pose.x}px, ${pose.y}px) rotate(${pose.angle}deg)`;}
