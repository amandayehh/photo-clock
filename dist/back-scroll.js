// Read overflowing backs back and forth while the card remains flipped.
export function createBackScroll(content,{reducedMotion=()=>false,fontSize=()=>16,onEdges=()=>{},schedule=requestAnimationFrame,cancel=cancelAnimationFrame}={}){
  let frame=null,started=null,previous=null,position=0,direction=1,pauseUntil=0,observer=null;
  function refresh(){
    const end=Math.max(0,content.scrollHeight-content.clientHeight);
    const top=Math.max(0,Math.min(end,content.scrollTop));
    // Allow one pixel for rounded scroll positions at the end.
    onEdges({top:top>1,bottom:end-top>1});
  }
  content.addEventListener?.('scroll',refresh,{passive:true});
  // Text can reflow after font loading as well as when the card changes size.
  if(typeof ResizeObserver!=='undefined'){
    observer=new ResizeObserver(refresh);
    observer.observe(content);
    for(const child of content.children)observer.observe(child);
  }
  function stop(){
    if(frame!==null)cancel(frame);
    frame=null;started=previous=null;position=0;direction=1;pauseUntil=0;content.scrollTop=0;
    refresh();
  }
  function tick(now){
    frame=null;
    if(reducedMotion())return;
    if(started===null)started=now;
    const end=Math.max(0,content.scrollHeight-content.clientHeight);
    if(!end)return;
    // Let the flip finish and give the first lines a moment to be read.
    if(now-started>=1400&&now>pauseUntil){
      const elapsed=previous===null?0:Math.min(now-Math.max(previous,pauseUntil),100);
      // Keep fractional progress independently: some browsers round scrollTop writes.
      position=Math.max(0,Math.min(end,position+direction*elapsed*Math.max(1,fontSize())*4/1000));
      content.scrollTop=position;
      // Pause only at a reached endpoint, never before the initial descent.
      if(direction===1&&position>=end||direction===-1&&position<=0){
        direction*=-1;
        pauseUntil=now+1000;
      }
      refresh();
    }
    previous=now;
    frame=schedule(tick);
  }
  return {refresh,setActive(active){stop();if(active&&!reducedMotion())frame=schedule(tick);},destroy(){stop();observer?.disconnect();content.removeEventListener?.('scroll',refresh);}};
}
