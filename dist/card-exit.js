import {stackLayer} from './card-layers.js';

export const exitTiming={duration:500,easing:'ease-in',fill:'forwards'};
export function collapseFadeDelay(collapseDuration){return Math.max(0,collapseDuration-1000);}

export function createCardExit(remove){
  const pending=new Map();
  function finishEntry(entry){
    const state=pending.get(entry);
    if(!state)return;
    pending.delete(entry);
    if(state.retired)remove(entry);
    state.animation.cancel();
  }
  function start(entry,delay=0){
    if(pending.has(entry))return pending.get(entry);
    // Animate the painted card itself: it moves out of its slot during view motion.
    const animation=entry.element.animate([{opacity:1},{opacity:0}],{...exitTiming,delay});
    const state={animation,retired:false,complete:false};
    pending.set(entry,state);
    const complete=()=>{
      if(pending.get(entry)!==state)return;
      state.complete=true;
      if(state.retired)finishEntry(entry);
    };
    animation.finished.then(complete,complete);
    return state;
  }
  return {
    start,
    retire(entry,animate){
      if(!animate){finishEntry(entry);remove(entry);return;}
      entry.slot.inert=true;
      Object.assign(entry.slot.style,{display:'block',position:'absolute',inset:'0',zIndex:String(stackLayer(entry)),pointerEvents:'none'});
      const state=start(entry);
      state.retired=true;
      if(state.complete)finishEntry(entry);
    },
    finish(){for(const entry of pending.keys())finishEntry(entry);}
  };
}
