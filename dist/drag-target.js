export function createLinkDropTarget(element,openLink,{isPortrait=()=>false}={}){
  function contains({x,y},approach=0){
    const bounds=element.getBoundingClientRect();
    const left=bounds.left-(isPortrait()?0:approach),top=bounds.top-(isPortrait()?approach:0);
    return x>=left&&x<=bounds.right&&y>=top&&y<=bounds.bottom;
  }
  function hide(){element.classList.remove('visible','over');}
  function cardApproaches(card){
    if(!card)return false;
    const bounds=element.getBoundingClientRect();
    const left=bounds.left-(isPortrait()?0:32),top=bounds.top-(isPortrait()?32:0);
    return card.right>=left&&card.left<=bounds.right&&card.bottom>=top&&card.top<=bounds.bottom;
  }
  return {
    hide,
    show(point,cardBounds){
      element.classList.add('visible');
      element.classList.toggle('over',contains(point,32)||cardApproaches(cardBounds));
    },
    release(sourceUrl,gesture){
      hide();
      if(!gesture.dragging||gesture.cancelled||!contains(gesture))return;
      // Open only the photograph's Commons page, directly inside the pointer-up gesture.
      try{
        const url=new URL(sourceUrl);
        if(url.protocol==='https:'&&url.hostname==='commons.wikimedia.org')openLink(url.href);
      }catch{/* No valid source link is available. */}
    }
  };
}
