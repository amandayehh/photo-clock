export function stackLayer(entry){return entry.sequence+1;}

export function applyCardLayers(entries){
  const top=entries.reduce((highest,entry)=>Math.max(highest,stackLayer(entry)),0)+1;
  for(const entry of entries){
    entry.element.style.zIndex=String(entry.pressed||entry.flipped?top:stackLayer(entry));
  }
}
