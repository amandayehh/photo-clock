import {entranceTiming} from './stack.js';

export const viewTiming={duration:700,easing:entranceTiming.easing,fill:'both'};

export function viewFrames(from,to){
  return [
    {transform:`translate(-50%, -50%) translate(${from.x-to.x}px, ${from.y-to.y}px) rotate(${from.angle}deg) scale(${from.width/to.width}, ${from.height/to.height})`,opacity:1},
    {transform:`translate(-50%, -50%) translate(0px, 0px) rotate(${to.angle}deg) scale(1, 1)`,opacity:1}
  ];
}

export function captureCards(entries,snapshots=new Map()){
  for(const entry of entries){
    // Keep live positions already captured, including interrupted animations.
    if(snapshots.has(entry))continue;
    const card=entry.element,rect=card.getBoundingClientRect(),style=getComputedStyle(card);
    const matrix=new DOMMatrixReadOnly(style.transform==='none'?undefined:style.transform);
    snapshots.set(entry,{
      x:rect.left+rect.width/2,y:rect.top+rect.height/2,
      width:parseFloat(style.width)*Math.hypot(matrix.a,matrix.b),
      height:parseFloat(style.height)*Math.hypot(matrix.c,matrix.d),
      angle:Math.atan2(matrix.b,matrix.a)*180/Math.PI
    });
  }
  return snapshots;
}

export function createViewMotion(){
  let active=null;
  function finish(){
    if(!active)return;
    const batch=active;active=null;
    for(const item of batch.items){
      item.animation.cancel();
      Object.assign(item.entry.element.style,item.style);
      item.entry.slot.append(item.entry.element);
      item.entry.slot.style.height=item.slotHeight;
    }
    batch.layer.remove();
    batch.onFinish?.();
  }
  function play(entries,before,onFinish){
    if(!entries.length){onFinish?.();return;}
    const after=captureCards(entries);
    const layer=document.createElement('div');layer.className='view-motion-layer';layer.inert=true;
    document.body.append(layer);
    const batch={layer,items:[],onFinish};active=batch;
    // Reserve the final cells before lifting cards into an unclipped animation layer.
    // This also keeps scrolled grid coordinates fixed while switching to the stack.
    const slots=entries.map(entry=>({height:entry.slot.getBoundingClientRect().height,previous:entry.slot.style.height}));
    entries.forEach((entry,index)=>{
      const card=entry.element,to=after.get(entry),from=before.get(entry)||to;
      const style={position:card.style.position,left:card.style.left,top:card.style.top,transform:card.style.transform};
      entry.slot.style.height=`${slots[index].height}px`;
      layer.append(card);
      Object.assign(card.style,{position:'absolute',left:`${to.x}px`,top:`${to.y}px`});
      const animation=card.animate(viewFrames(from,to),viewTiming);
      batch.items.push({entry,style,slotHeight:slots[index].previous,animation});
    });
    Promise.all(batch.items.map(item=>item.animation.finished)).then(()=>{if(active===batch)finish();},()=>{if(active===batch)finish();});
  }
  return {play,finish};
}
