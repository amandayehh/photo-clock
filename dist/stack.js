import {hash} from './core.js';
export function cleanTitle(title){
  let value=String(title||'New York').replace(/^File:/i,'').replace(/\.(?:jpe?g|png|webp|tiff?)$/i,'').replaceAll('_',' ');
  // Remove nested parentheticals as well as their enclosing parentheses.
  while(/\([^()]*\)/.test(value))value=value.replace(/\([^()]*\)/g,' ');
  return value.replace(/\s+/g,' ').trim()||'New York';
}
export function stackLayout(width,height,ratios){
  const short=Math.min(width,height),pad=Math.max(7,Math.min(20,short*10/544));
  const titleSize=Math.max(14,Math.min(40,short*20/544));
  const stampSize=Math.max(9,titleSize*.45);
  const gap=pad*.75,theta=3*Math.PI/180;
  const shapes=ratios.length?ratios:[1];
  // One common fit factor preserves equal image area even on narrow screens.
  // The requested reference is a square with side = 50% of the shorter dimension.
  const fits=side=>shapes.every(r=>{
    const w=side*Math.sqrt(r)+2*pad,h=side/Math.sqrt(r)+2*pad+2*gap+titleSize*1.15+stampSize*1.15;
    return w*Math.cos(theta)+h*Math.sin(theta)<=width*.92 && h*Math.cos(theta)+w*Math.sin(theta)<=height*.84;
  });
  let low=0,high=short*.5;
  if(!fits(high)){for(let n=0;n<32;n++){const middle=(low+high)/2;if(fits(middle))low=middle;else high=middle;}}
  return {side:high,area:high*high,pad,gap,titleSize,stampSize,radius:pad*.8};
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
