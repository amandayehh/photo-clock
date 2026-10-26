export function createLinkDropTarget(element,openLink){
  function contains({x,y}){
    const bounds=element.getBoundingClientRect();
    return x>=bounds.left&&x<=bounds.right&&y>=bounds.top&&y<=bounds.bottom;
  }
  function hide(){element.classList.remove('visible','over');}
  return {
    hide,
    show(point){
      element.classList.add('visible');
      element.classList.toggle('over',contains(point));
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
