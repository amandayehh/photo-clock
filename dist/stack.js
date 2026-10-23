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
  const gap=pad,theta=3*Math.PI/180;
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
// Physical spring from the supplied Figma settings, starting at rest.
export const entranceSpring=Object.freeze({mass:1,stiffness:100,damping:15,delay:0});
const decay=entranceSpring.damping/(2*entranceSpring.mass);
const frequency=Math.sqrt(entranceSpring.stiffness/entranceSpring.mass-decay**2);
// Stop only once the entire remaining oscillation is below 0.01% of travel.
const springDuration=Math.ceil(Math.log(Math.hypot(1,decay/frequency)/.0001)/decay*1000);
// Play the complete spring curve in exactly one second.
const duration=1000;
export const entranceTiming=Object.freeze({duration,delay:entranceSpring.delay,easing:'linear',fill:'backwards'});
export function springProgress(seconds){
  return 1-Math.exp(-decay*seconds)*(Math.cos(frequency*seconds)+decay/frequency*Math.sin(frequency*seconds));
}
export function entranceFrames(pose,viewportHeight,cardHeight){
  // Begin centered and level, fully above the viewport, including the shadow.
  const p0={x:0,y:-(viewportHeight+cardHeight)/2-80};
  const steps=Math.ceil(duration/1000*120);
  return Array.from({length:steps+1},(_,i)=>{
    const offset=i/steps;
    const t=i===steps?1:springProgress(offset*springDuration/1000);
    const x=p0.x+(pose.x-p0.x)*t;
    const y=p0.y+(pose.y-p0.y)*t;
    const angle=pose.angle*t;
    return {offset,transform:`translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${angle}deg)`,opacity:1};
  });
}
export function settledTransform(pose){return `translate(-50%, -50%) translate(${pose.x}px, ${pose.y}px) rotate(${pose.angle}deg)`;}
