import {getSvgPath} from './vendor/figma-squircle.js';
export const cornerSmoothing=.6;
export function smoothPath(width,height,cornerRadius){
  return getSvgPath({width,height,cornerRadius,cornerSmoothing}).replace(/\s+/g,' ').trim();
}
export function smoothSurface(width,height,radius,color='white'){
  const path=smoothPath(width,height,radius);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${path}" fill="${color}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
export function applySmoothing(entry,size,layout){
  const width=size.width+2*layout.pad;
  const height=parseFloat(getComputedStyle(entry.front).height);
  entry.element.style.setProperty('--card-surface',smoothSurface(width,height,layout.radius));
  entry.element.style.setProperty('--card-pressed-surface',smoothSurface(width,height,layout.radius,'hsl(0, 0%, 85%)'));
  entry.image.style.clipPath=`path("${smoothPath(size.width,size.height,layout.radius/2)}")`;
}
