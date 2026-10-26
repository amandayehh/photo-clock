// Read overflowing backs from top to bottom once per flip, then hold the end.
export function createBackScroll(content,{reducedMotion=()=>false,fontSize=()=>16,schedule=requestAnimationFrame,cancel=cancelAnimationFrame}={}){
  let frame=null,started=null,previous=null;
  function stop(){
    if(frame!==null)cancel(frame);
    frame=null;started=previous=null;content.scrollTop=0;
  }
  function tick(now){
    frame=null;
    if(reducedMotion())return;
    if(started===null)started=now;
    const end=Math.max(0,content.scrollHeight-content.clientHeight);
    if(!end)return;
    // Let the flip finish and give the first lines a moment to be read.
    if(now-started>=1400){
      const elapsed=previous===null?0:Math.min(now-previous,100);
      content.scrollTop=Math.min(end,content.scrollTop+elapsed*Math.max(1,fontSize())/1000);
      if(content.scrollTop>=end-1){content.scrollTop=end;return;}
    }
    previous=now;
    frame=schedule(tick);
  }
  return {setActive(active){stop();if(active&&!reducedMotion())frame=schedule(tick);}};
}
