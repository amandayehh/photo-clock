let activeRelease=null;
export function releaseHeldCard(){activeRelease?.();}

export function bindCardInteraction(card,{onLift,onMove,onFlip,onDetails}){
  let pointer=null,holdingSpace=false,flipTimer=null;
  function cancelFlip(){clearTimeout(flipTimer);flipTimer=null;}
  function release(){
    cancelFlip();
    const id=pointer?.id;
    pointer=null;holdingSpace=false;
    onFlip(false);
    if(activeRelease===release)activeRelease=null;
    if(id!==undefined&&card.hasPointerCapture(id))card.releasePointerCapture(id);
  }
  function lift(flipImmediately=true){releaseHeldCard();activeRelease=release;onLift();if(flipImmediately)onFlip(true);}
  function move(event){
    if(!pointer||event.pointerId!==pointer.id)return;
    // Small pointer jitter is okay; an intentional drag cancels the hold gesture.
    if(!pointer.dragging&&Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY)>6){
      pointer.dragging=true;cancelFlip();onFlip(false);
    }
    onMove(event.clientX-pointer.x,event.clientY-pointer.y);
    pointer.x=event.clientX;pointer.y=event.clientY;
  }
  card.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.isPrimary===false)return;
    event.preventDefault();
    lift(false);
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,dragging:false};
    flipTimer=setTimeout(()=>{flipTimer=null;if(pointer&&!pointer.dragging)onFlip(true);},600);
    card.setPointerCapture(event.pointerId);
    card.focus({preventScroll:true});
  });
  card.addEventListener('pointermove',move);
  card.addEventListener('pointerup',event=>{
    if(event.pointerId!==pointer?.id)return;
    move(event);release();
  });
  for(const type of ['pointercancel','lostpointercapture'])card.addEventListener(type,event=>{
    if(event.pointerId===pointer?.id)release();
  });
  card.addEventListener('keydown',event=>{
    if(event.code==='Space'){
      event.preventDefault();
      if(!holdingSpace){lift();holdingSpace=true;}
    }else if(event.key==='Escape'){release();}
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();onLift();
      const step=event.shiftKey?30:10;
      onMove(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0);
    }
  });
  card.addEventListener('keyup',event=>{if(event.code==='Space'){event.preventDefault();release();}});
  card.addEventListener('blur',release);
  // Pointer clicks end the hold; Enter and assistive activation open accessible details.
  card.addEventListener('click',event=>{if(event.detail===0&&!holdingSpace)onDetails();});
}
